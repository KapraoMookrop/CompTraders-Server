import pool from '../../config/database.js';
import { AppError } from "../../utils/errors/AppError.js";
import { drive } from '../../config/driveConfig.js';
import type { DealSearchCriteria } from '../../module/DealSearchCriteria.js';
import type { DealAdminData } from '../../module/DealAdminData.js';
import type { ResponseData } from '../../module/ResponseData.js';
import { DealStatus, EscrowTransactionType, EscrowWalletStatus, PaymentStatus } from '../../module/Enum.js';
import axios from 'axios';

export async function FindAsync(criteria: DealSearchCriteria): Promise<ResponseData<DealAdminData>> {
    const page = criteria.Page ?? 1;
    const pageSize = criteria.PageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const sortByMap: Record<string, string> = {
        Title: "d.title",
        Amount: "d.amount",
        Status: "d.status",
        CreatedAt: "d.created_at"
    };

    const sortColumn = sortByMap[criteria.SortBy] || "d.created_at";
    const sortDirection = criteria.SortDirection === "ASC" ? "ASC" : "DESC";

    const { where, params } = BuildWhereClause(criteria);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(pageSize);
    params.push(offset);

    const dataQuery = `
    SELECT 
        d.id,
        d.chat_room_id,
        d.buyer_id,
        ub.full_name as buyer_name,
        d.seller_id,
        us.full_name as seller_name,
        d.title,
        d.description,
        d.amount,
        d.status,
        d.created_at,
        p.id as payment_id,
        p.status as payment_status,
        ps.slip_url
    FROM ct.deals d
    LEFT JOIN ct.users ub ON d.buyer_id = ub.id
    LEFT JOIN ct.users us ON d.seller_id = us.id
    LEFT JOIN ct.payments p ON d.id = p.deal_id
    LEFT JOIN ct.payment_slips ps ON p.id = ps.payment_id
    ${whereSql}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const dataResult = await pool.query(dataQuery, params);

    const countQuery = `
    SELECT COUNT(*)
    FROM ct.deals d
    LEFT JOIN ct.users ub ON d.buyer_id = ub.id
    LEFT JOIN ct.users us ON d.seller_id = us.id
    ${whereSql}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const data = dataResult.rows.map((row) => ({
        Id: row.id,
        ChatRoomId: row.chat_room_id,
        BuyerId: row.buyer_id,
        BuyerName: row.buyer_name,
        SellerId: row.seller_id,
        SellerName: row.seller_name,
        Title: row.title,
        Description: row.description,
        Amount: Number(row.amount),
        Status: row.status,
        CreatedAt: row.created_at,
        PaymentId: row.payment_id || undefined,
        PaymentStatus: row.payment_status || undefined,
        SlipUrl: row.slip_url || undefined
    } as DealAdminData));

    return {
        Data: data,
        TotalCount: total
    };
}

function BuildWhereClause(criteria: DealSearchCriteria): { where: string[], params: any[] } {
    let where: string[] = [];
    let params: any[] = [];
    let index = 1;

    if (criteria.Title) {
        where.push(`d.title ILIKE $${index}`);
        params.push(`%${criteria.Title}%`);
        index++;
    }

    if (criteria.SellerName) {
        where.push(`us.full_name ILIKE $${index}`);
        params.push(`%${criteria.SellerName}%`);
        index++;
    }

    if (criteria.BuyerName) {
        where.push(`ub.full_name ILIKE $${index}`);
        params.push(`%${criteria.BuyerName}%`);
        index++;
    }

    if (criteria.DealStatus) {
        where.push(`d.status = $${index}`);
        params.push(criteria.DealStatus);
        index++;
    }

    return { where, params };
}

export async function GetDealByIdAsync(dealId: string): Promise<DealAdminData> {
    const result = await pool.query(
        `SELECT 
            d.id,
            d.chat_room_id,
            d.buyer_id,
            ub.full_name as buyer_name,
            d.seller_id,
            us.full_name as seller_name,
            d.title,
            d.description,
            d.amount,
            d.status,
            d.created_at,
            p.id as payment_id,
            p.status as payment_status,
            ps.slip_url,
            s.carrier,
            s.tracking_number,
            df.file_url as package_image_url
         FROM ct.deals d
         LEFT JOIN ct.users ub ON d.buyer_id = ub.id
         LEFT JOIN ct.users us ON d.seller_id = us.id
         LEFT JOIN ct.payments p ON d.id = p.deal_id
         LEFT JOIN ct.payment_slips ps ON p.id = ps.payment_id
         LEFT JOIN ct.shipments s ON d.id = s.deal_id
         LEFT JOIN ct.deal_files df ON d.id = df.deal_id AND df.file_type = 'IMAGE'
         WHERE d.id = $1`,
        [dealId]
    );

    if (result.rowCount === 0) {
        throw new AppError('ไม่พบข้อมูลดีล', 404);
    }

    const row = result.rows[0];
    let slipImageBase64: string | undefined = undefined;
    let packageImageBase64: string | undefined = undefined;

    if (row.slip_url) {
        try {
            const driveResponse = await drive.files.get(
                { fileId: row.slip_url, alt: 'media' },
                { responseType: 'stream' }
            );
            const chunks: any[] = [];
            for await (const chunk of driveResponse.data) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            slipImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (err) {
            console.error("Failed to load slip image from Drive for Admin:", err);
        }
    }

    if (row.package_image_url) {
        try {
            const driveResponse = await drive.files.get(
                { fileId: row.package_image_url, alt: 'media' },
                { responseType: 'stream' }
            );
            const chunks: any[] = [];
            for await (const chunk of driveResponse.data) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            packageImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (err) {
            console.error("Failed to load package image from Drive for Admin:", err);
        }
    }

    return {
        Id: row.id,
        ChatRoomId: row.chat_room_id,
        BuyerId: row.buyer_id,
        BuyerName: row.buyer_name,
        SellerId: row.seller_id,
        SellerName: row.seller_name,
        Title: row.title,
        Description: row.description,
        Amount: Number(row.amount),
        Status: row.status,
        CreatedAt: row.created_at,
        PaymentId: row.payment_id || undefined,
        PaymentStatus: row.payment_status || undefined,
        SlipUrl: row.slip_url || undefined,
        SlipImageBase64: slipImageBase64,
        Carrier: row.carrier || undefined,
        TrackingNumber: row.tracking_number || undefined,
        PackageImageUrl: row.package_image_url || undefined,
        PackageImageBase64: packageImageBase64
    };
}

export async function ConfirmPayment(dealId: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. อัปเดตสถานะ Payment เป็น CONFIRMED และอัปเดต confirmed_at
        await client.query(
            `UPDATE ct.payments
             SET status = $2, confirmed_at = NOW()
             WHERE deal_id = $1`,
            [dealId, PaymentStatus.CONFIRMED]
        );

        // 2. อัปเดตสถานะดีลใน ct.deals เป็น PAID
        await client.query(
            `UPDATE ct.deals
             SET status = $2, paid_at = NOW()
             WHERE id = $1`,
            [dealId, DealStatus.PAID]
        );

        // ดึงข้อมูลดีลเพื่อนำไปใส่ Escrow Wallet
        const dealResult = await client.query(
            `SELECT amount, chat_room_id, buyer_id FROM ct.deals WHERE id = $1`,
            [dealId]
        );
        if (dealResult.rowCount === 0) {
            throw new AppError('ไม่พบข้อมูลดีล', 404);
        }
        const amount = Number(dealResult.rows[0].amount);
        const chatRoomId = dealResult.rows[0].chat_room_id;
        const buyerId = dealResult.rows[0].buyer_id;

        // 3. สร้าง Escrow Wallet (สถานะ HOLDING)
        const walletResult = await client.query(
            `INSERT INTO ct.escrow_wallets (deal_id, balance, status)
             VALUES ($1, $2, $3) RETURNING id`,
            [dealId, amount, EscrowWalletStatus.HOLDING]
        );
        const walletId = walletResult.rows[0].id;

        // 4. บันทึก Escrow Transaction (ประเภท DEPOSIT)
        await client.query(
            `INSERT INTO ct.escrow_transactions (wallet_id, type, amount)
             VALUES ($1, $2, $3)`,
            [walletId, EscrowTransactionType.DEPOSIT, amount]
        );

        // ค้นหา admin user_id เพื่อนำมาใส่เป็นผู้ส่งของข้อความระบบ
        const adminUserResult = await client.query(
            "SELECT id FROM ct.users WHERE role = 'ADMIN' LIMIT 1"
        );
        const senderId = (adminUserResult.rowCount ?? 0) > 0 ? adminUserResult.rows[0].id : buyerId;

        // 5. บันทึกข้อความแจ้งยืนยันยอดเงินของระบบในห้องแชท
        const systemMessageContent = `[ระบบ] ผู้ดูแลระบบได้ยืนยันยอดเงินโอนเข้าบัญชี Escrow เรียบร้อยแล้ว ขณะนี้เงินอยู่ในระบบอย่างปลอดภัย กรุณาดำเนินการขั้นต่อไป`;
        const messageInsert = await client.query(
            `INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content)
             VALUES ($1, $2, 'TEXT', $3) RETURNING *`,
            [chatRoomId, senderId, systemMessageContent]
        );
        const newMessage = messageInsert.rows[0];

        await client.query("COMMIT");

        // 6. ดึงสมาชิกทั้งหมดในห้องเพื่อกระจายข้อความ Socket ให้หน้าจออัปเดตแบบเรียลไทม์
        const members = await pool.query(
            `SELECT user_id FROM ct.chat_room_members WHERE chat_room_id = $1`,
            [chatRoomId]
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
                            SenderName: "ระบบ (System)",
                            ContentType: newMessage.content_type,
                            Content: newMessage.content,
                            CreatedAt: newMessage.created_at
                        }
                    })
                )
            );
        } catch (err) {
            console.error("Failed to emit payment confirmation socket notification:", err);
        }
    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการยืนยันยอดเงินเข้าระบบ Escrow: ${error}`, 500);
    } finally {
        client.release();
    }
}

export async function ReleaseEscrow(dealId: string) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. ตรวจสอบสถานะดีลปัจจุบัน
        const dealResult = await client.query(
            `SELECT chat_room_id, buyer_id, seller_id, amount, status FROM ct.deals WHERE id = $1`,
            [dealId]
        );
        if (dealResult.rowCount === 0) {
            throw new AppError("ไม่พบดีลนี้ในระบบ", 404);
        }
        const deal = dealResult.rows[0];
        if (deal.status !== DealStatus.DELIVERED) {
            throw new AppError("สถานะดีลไม่ถูกต้อง (ต้องเป็น DELIVERED เท่านั้น)", 400);
        }

        const amount = Number(deal.amount);

        // 2. อัปเดตสถานะดีลเป็น COMPLETED
        await client.query(
            `UPDATE ct.deals
             SET status = $2, completed_at = NOW()
             WHERE id = $1`,
            [dealId, DealStatus.COMPLETED]
        );

        // 3. ดึงข้อมูล Escrow Wallet ของดีลนี้
        const walletResult = await client.query(
            `SELECT id FROM ct.escrow_wallets WHERE deal_id = $1`,
            [dealId]
        );
        if (walletResult.rowCount === 0) {
            throw new AppError("ไม่พบ Escrow Wallet สำหรับดีลนี้", 404);
        }
        const walletId = walletResult.rows[0].id;

        // 4. อัปเดตสถานะ Escrow Wallet เป็น RELEASED
        await client.query(
            `UPDATE ct.escrow_wallets
             SET status = $2
             WHERE id = $1`,
            [walletId, EscrowWalletStatus.RELEASED]
        );

        // 5. บันทึกประวัติ Escrow Transaction ประเภท RELEASE
        await client.query(
            `INSERT INTO ct.escrow_transactions (wallet_id, type, amount)
             VALUES ($1, $2, $3)`,
            [walletId, EscrowTransactionType.RELEASE, amount]
        );

        // 6. ดึงข้อมูลผู้ส่ง (Admin) หรือตั้งระบบ
        const adminUserResult = await client.query(
            "SELECT id FROM ct.users WHERE role = 'ADMIN' LIMIT 1"
        );
        const adminId = (adminUserResult.rowCount ?? 0) > 0 ? adminUserResult.rows[0].id : deal.buyer_id;

        // 7. บันทึกข้อความแจ้งเตือนเข้าระบบแชท
        const systemMessageContent = `[ระบบ] ดีลเสร็จสิ้นสมบูรณ์! ผู้ดูแลระบบได้ทำการโอนเงินค่าสินค้าออกจากระบบ Escrow ไปยังบัญชีผู้ขายเรียบร้อยแล้ว`;
        const messageInsert = await client.query(
            `INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content)
             VALUES ($1, $2, 'TEXT', $3) RETURNING *`,
            [deal.chat_room_id, adminId, systemMessageContent]
        );
        const newMessage = messageInsert.rows[0];

        await client.query("COMMIT");

        // 8. ดึงสมาชิกทั้งหมดในห้องเพื่อส่ง WebSocket
        const members = await pool.query(
            `SELECT user_id FROM ct.chat_room_members WHERE chat_room_id = $1`,
            [deal.chat_room_id]
        );

        try {
            await Promise.all(
                members.rows.map((m) =>
                    axios.post(process.env.SOCKET_URL + "/emit", {
                        type: "new-message",
                        chatRoomId: deal.chat_room_id,
                        userId: m.user_id,
                        message: {
                            Id: newMessage.id,
                            ChatRoomId: newMessage.chat_room_id,
                            SenderId: newMessage.sender_id,
                            SenderName: "ระบบ (System)",
                            ContentType: newMessage.content_type,
                            Content: newMessage.content,
                            CreatedAt: newMessage.created_at
                        }
                    })
                )
            );
        } catch (err) {
            console.error("Failed to emit release escrow socket notification:", err);
        }
    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการโอนเงินให้ผู้ขาย (Release Escrow): ${error}`, 500);
    } finally {
        client.release();
    }
}
