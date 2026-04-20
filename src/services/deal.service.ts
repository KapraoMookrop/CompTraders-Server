import type { UUID } from "node:crypto";
import pool from "../config/database.js";
import { type CreateDealRequest } from "../module/CreateDealRequest.js";
import { AppError } from "../utils/errors/AppError.js";
import type { CreateChatRoomRequest } from "../module/CreateChatRoomRequest.js";
import { ChatRoomMemberStatus, ChatRoomStatus, NotificationType } from "../module/Enum.js";
import type { UserJWT } from "../module/UserJWT.js";

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