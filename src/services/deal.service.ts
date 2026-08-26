import type { UUID } from "node:crypto";
import pool from "../config/database.js";
import { type CreateDealRequest } from "../module/CreateDealRequest.js";
import { AppError } from "../utils/errors/AppError.js";
import type { CreateChatRoomRequest } from "../module/CreateChatRoomRequest.js";
import { ChatRoomMemberStatus, ChatRoomStatus, NotificationType, DealStatus, ShipmentStatus } from "../module/Enum.js";
import type { UserJWT } from "../module/UserJWT.js";
import { uploadFileToDrive } from "../utils/drive-upload/GoogleDrive.js";
import axios from "axios";

export async function CreateChatRoom(request: CreateChatRoomRequest, UserJWT: UserJWT): Promise<UUID> {
    const { CreatorId, InviteeId } = request;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const room = await client.query(
            `INSERT INTO ct.chat_rooms (creator_id, invitee_id, status)
             VALUES ($1, $2, $3) RETURNING id`,
            [CreatorId, InviteeId, ChatRoomStatus.ACTIVE]
        );

        const chatRoomId = room.rows[0].id;

        const chatRoomMembers = await client.query(
            `INSERT INTO ct.chat_room_members
                (chat_room_id, user_id, last_read_at, status)
            VALUES ($1, $2, NOW(), $4),
                   ($1, $3, NOW(), $5)
            RETURNING id`,
            [chatRoomId, CreatorId, InviteeId, ChatRoomMemberStatus.ACTIVE, ChatRoomMemberStatus.PENDING]
        );

        await client.query(
            `INSERT INTO ct.notifications 
                (user_id, type, title, message, related_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [InviteeId, NotificationType.CHAT_INVITE, "คุณได้รับคำเชิญเข้าร่วมแชท", "คุณได้รับคำเชิญเข้าร่วมแชทจากผู้ใช้ " + UserJWT.fullName, chatRoomMembers.rows[1].id]
        );

        await client.query("COMMIT");

        return chatRoomId;

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating chat room:", err);
        throw new AppError("ไม่สามารถสร้างห้องแชทได้ กรุณาลองใหม่อีกครั้ง" + err, 500);
    } finally {
        client.release();
    }
}

export async function CreateDeal(request: CreateDealRequest) {
    const { ChatRoomId, BuyerId, SellerId, Title, Description, Amount, Status } = request;

    const createDeal = await pool.query(
        "INSERT INTO ct.deals (chat_room_id, buyer_id, seller_id, title, description, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [ChatRoomId, BuyerId, SellerId, Title, Description, Amount, Status]
    );

    const dealIdValue = createDeal.rows[0].id;

    return dealIdValue;
}

export async function AcceptInvite(chatRoomMemberId: string) {
    console.log("Accepting chat invite for chatRoomMemberId:", chatRoomMemberId);
    await pool.query(
        `UPDATE ct.chat_room_members
         SET status = $1, last_read_at = NOW()
         WHERE id = $2`,
        [ChatRoomMemberStatus.ACTIVE, chatRoomMemberId]
    );

    await pool.query(
        `DELETE FROM ct.notifications
         WHERE related_id = $1`,
        [chatRoomMemberId]
    );
}

export async function RejectInvite(chatRoomMemberId: string, currentUserId: string) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const sqlChatRoomMember = await client.query(
            `SELECT 
            cem.id as chat_room_member_id,
            cr.id as chat_room_id,
            u.id as user_id,
            u.full_name as full_name
        FROM ct.chat_room_members cem
            LEFT JOIN ct.chat_rooms cr ON cem.chat_room_id = cr.id
            LEFT JOIN ct.users u ON (u.id = cr.creator_id or u.id = cr.invitee_id)
        WHERE cem.id = $1`,
            [chatRoomMemberId]
        );

        if (sqlChatRoomMember.rowCount === 0) {
            throw new AppError("ไม่พบคำเชิญเข้าร่วมแชทนี้", 404);
        }

        const curretUser = sqlChatRoomMember.rows.find((row) => row.user_id == currentUserId);
        const otherUser = sqlChatRoomMember.rows.find((row) => row.user_id != currentUserId);

        console.log("Current User:", curretUser);
        console.log("Other User:", otherUser);

        await client.query(
            `INSERT INTO ct.notifications 
            (user_id, type, title, message, related_id)
         VALUES ($1, $2, $3, $4, $5)`,
            [otherUser.user_id, NotificationType.CHAT_REJECT, "คำเชิญเข้าร่วมแชทถูกปฏิเสธ", "คำเชิญเข้าร่วมแชทของคุณถูกปฏิเสธโดยผู้ใช้ " + curretUser.full_name, chatRoomMemberId]
        );

        await client.query(
            `DELETE FROM ct.chat_room_members
         WHERE id = $1`,
            [chatRoomMemberId]
        );

        await client.query(
            `DELETE FROM ct.chat_rooms
         WHERE id = $1`,
            [sqlChatRoomMember.rows[0].chat_room_id]
        );

        await client.query(
            "DELETE FROM ct.notifications WHERE related_id = $1 AND user_id = $2",
            [chatRoomMemberId, currentUserId]
        );

        await client.query("COMMIT");
    }
    catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Error rejecting chat invite:", err);
        throw new AppError("เกิดข้อผิดพลาดขณะปฏิเสธคำเชิญเข้าร่วมแชท" + err.Error, 500);
    }
    finally {
        client.release();
    }
}

export async function UploadPaymentSlip(dealId: string, buyerId: string, userFullName: string, file: Express.Multer.File) {
    const configFolderId = await pool.query("SELECT value FROM ct.configuration WHERE code = 'GoogleDriveFolderId'");
    if (configFolderId.rows.length === 0) {
        throw new AppError("ไม่พบการตั้งค่าโฟลเดอร์บน Google Drive กรุณาติดต่อผู้ดูแลระบบ", 500);
    }
    const FOLDER_ID = configFolderId.rows[0].value;

    // อัปโหลดไฟล์สลิปไปยัง Google Drive
    const uploadResult = await uploadFileToDrive(file, `slip_${dealId}_${Date.now()}.jpg`, FOLDER_ID, userFullName);

    // ดึงจำนวนเงินของดีลเพื่อมาบันทึกในตารางการชำระเงิน
    const dealResult = await pool.query("SELECT amount FROM ct.deals WHERE id = $1", [dealId]);
    if (dealResult.rows.length === 0) {
        throw new AppError("ไม่พบดีลนี้ในระบบ", 404);
    }
    const amount = dealResult.rows[0].amount;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // สร้างรายการการชำระเงิน (Payments) ด้วยสถานะ PENDING
        const paymentInsert = await client.query(
            `INSERT INTO ct.payments (deal_id, payer_id, amount, status) 
             VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
            [dealId, buyerId, amount]
        );
        const paymentId = paymentInsert.rows[0].id;

        // บันทึกที่อยู่รูปภาพสลิปที่ได้จากไดร์ฟลงในตาราง Payment Slips
        await client.query(
            `INSERT INTO ct.payment_slips (payment_id, slip_url) 
             VALUES ($1, $2)`,
            [paymentId, uploadResult.id]
        );

        // ดึงข้อมูลห้องแชทของดีลนี้เพื่อบันทึกและแจ้งเตือนข้อความระบบ
        const dealInfo = await client.query(
            "SELECT chat_room_id FROM ct.deals WHERE id = $1",
            [dealId]
        );
        const chatRoomId = dealInfo.rows[0].chat_room_id;

        // บันทึกข้อความแจ้งเตือนสลิปในห้องแชท
        const systemMessageContent = `[ระบบ] ผู้ซื้อได้อัปโหลดหลักฐานการโอนเงินเรียบร้อยแล้ว รอผู้ดูแลระบบตรวจสอบยอดเงิน`;
        const messageInsert = await client.query(
            `INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content)
             VALUES ($1, $2, 'TEXT', $3) RETURNING *`,
            [chatRoomId, buyerId, systemMessageContent]
        );
        const newMessage = messageInsert.rows[0];

        await client.query("COMMIT");

        // ดึงสมาชิกห้องแชทอื่นที่ไม่ใช่ผู้ส่งเพื่อส่ง Socket update
        const members = await pool.query(
            `SELECT user_id FROM ct.chat_room_members WHERE chat_room_id = $1 AND user_id != $2`,
            [chatRoomId, buyerId]
        );

        // ยิง API ไปยัง socket server เพื่อให้ฝั่งผู้ขายหน้าจออัปเดตเรียลไทม์
        try {
            await Promise.all(
                members.rows.map((m) =>
                    axios.post(process.env.SOCKET_URL + "/emit", {
                        type: "new-message",
                        chatRoomId: chatRoomId,
                        userId: m.user_id,
                        message: {
                            Id: newMessage.id,
                            ChatRoomId: newMessage.chat_room_id,
                            SenderId: newMessage.sender_id,
                            SenderName: userFullName,
                            ContentType: newMessage.content_type,
                            Content: newMessage.content,
                            CreatedAt: newMessage.created_at
                        }
                    })
                )
            );
        } catch (err) {
            console.error("Failed to emit upload slip socket notification:", err);
        }

        return { success: true, paymentId };
    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการบันทึกหลักฐานการโอนเงิน: ${error}`, 500);
    } finally {
        client.release();
    }
}

// ฟังก์ชันจำลองการเรียกใช้ Tracking API เพื่อตรวจสอบความถูกต้องของเลขพัสดุ
async function validateTrackingNumberWithCarrier(carrier: string, trackingNumber: string): Promise<boolean> {
    // ในอนาคตสามารถเชื่อมต่อกับ API ของขนส่งจริง เช่น Flash Express, Kerry Express, DHL, Thailand Post ได้ที่นี่
    // ตัวอย่างการทำงาน:
    // try {
    //     const apiKey = process.env.CARRIER_API_KEY;
    //     const response = await axios.get(`https://api.carrier.com/v1/track?carrier=${carrier}&num=${trackingNumber}`, {
    //         headers: { 'Authorization': `Bearer ${apiKey}` }
    //     });
    //     return response.data.status === 'valid';
    // } catch (e) {
    //     console.error("Carrier API error:", e);
    //     return false;
    // }

    // ปัจจุบันเป็น Dummy ตรวจสอบผ่านเสมอ (ตามข้อกำหนดของระบบ)
    return true;
}

export async function ShipDeal(dealId: string, sellerId: string, userFullName: string, carrier: string, trackingNumber: string, file: Express.Multer.File) {
    // 0. เรียกใช้ระบบตรวจสอบเลขพัสดุผ่าน API ของขนส่ง
    const isTrackingValid = await validateTrackingNumberWithCarrier(carrier, trackingNumber);
    if (!isTrackingValid) {
        throw new AppError("เลขพัสดุไม่ถูกต้องหรือไม่พบข้อมูลในระบบของขนส่ง", 400);
    }

    const configFolderId = await pool.query("SELECT value FROM ct.configuration WHERE code = 'GoogleDriveFolderId'");
    if (configFolderId.rows.length === 0) {
        throw new AppError("ไม่พบการตั้งค่าโฟลเดอร์บน Google Drive กรุณาติดต่อผู้ดูแลระบบ", 500);
    }
    const FOLDER_ID = configFolderId.rows[0].value;

    // อัปโหลดไฟล์รูปภาพพัสดุไปยัง Google Drive
    const uploadResult = await uploadFileToDrive(file, `package_${dealId}_${Date.now()}.jpg`, FOLDER_ID, userFullName);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. อัปเดตสถานะดีลเป็น SHIPPING และกำหนดวัน Release เงินเข้า Escrow อัตโนมัติ (เช่น 7 วันข้างหน้า)
        await client.query(
            `UPDATE ct.deals
             SET status = $2, auto_release_at = NOW() + INTERVAL '7 days'
             WHERE id = $1`,
            [dealId, DealStatus.SHIPPING]
        );

        // 2. บันทึกข้อมูลการจัดส่งใน ct.shipments
        const shipmentInsert = await client.query(
            `INSERT INTO ct.shipments (deal_id, carrier, tracking_number, status, shipped_at)
             VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
            [dealId, carrier, trackingNumber, ShipmentStatus.SHIPPED]
        );
        const shipmentId = shipmentInsert.rows[0].id;

        // 3. บันทึกรูปถ่ายพัสดุใน ct.deal_files
        await client.query(
            `INSERT INTO ct.deal_files (deal_id, file_url, file_type, uploaded_by)
             VALUES ($1, $2, 'IMAGE', $3)`,
            [dealId, uploadResult.id, sellerId]
        );

        // 4. บันทึกประวัติการจัดส่งใน ct.shipment_tracking_events
        await client.query(
            `INSERT INTO ct.shipment_tracking_events (shipment_id, status, location, description, event_time)
             VALUES ($1, $2, 'คลังสินค้าต้นทาง', 'ผู้ขายได้ทำการจัดส่งสินค้าและเข้าระบบเรียบร้อยแล้ว', NOW())`,
            [shipmentId, ShipmentStatus.SHIPPED]
        );

        // 5. บันทึกข้อความแจ้งการจัดส่งพัสดุในห้องแชท
        const dealInfo = await client.query(
            "SELECT chat_room_id FROM ct.deals WHERE id = $1",
            [dealId]
        );
        const chatRoomId = dealInfo.rows[0].chat_room_id;

        const systemMessageContent = `[ระบบ] ผู้ขายได้จัดส่งสินค้าเรียบร้อยแล้ว\nขนส่ง: ${carrier}\nเลขพัสดุ: ${trackingNumber}`;
        const messageInsert = await client.query(
            `INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content)
             VALUES ($1, $2, 'TEXT', $3) RETURNING *`,
            [chatRoomId, sellerId, systemMessageContent]
        );
        const newMessage = messageInsert.rows[0];

        await client.query("COMMIT");

        // 6. ดึงข้อมูลสมาชิกแชทอื่นเพื่อกระจายข้อความ Socket ให้หน้าจออัปเดตแบบเรียลไทม์
        const members = await pool.query(
            `SELECT user_id FROM ct.chat_room_members WHERE chat_room_id = $1 AND user_id != $2`,
            [chatRoomId, sellerId]
        );

        try {
            await Promise.all(
                members.rows.map((m) =>
                    axios.post(process.env.SOCKET_URL + "/emit", {
                        type: "new-message",
                        chatRoomId: chatRoomId,
                        userId: m.user_id,
                        message: {
                            Id: newMessage.id,
                            ChatRoomId: newMessage.chat_room_id,
                            SenderId: newMessage.sender_id,
                            SenderName: userFullName,
                            ContentType: newMessage.content_type,
                            Content: newMessage.content,
                            CreatedAt: newMessage.created_at
                        }
                    })
                )
            );
        } catch (err) {
            console.error("Failed to emit ship deal socket notification:", err);
        }

        return { success: true, shipmentId };
    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการบันทึกข้อมูลการจัดส่ง: ${error}`, 500);
    } finally {
        client.release();
    }
}