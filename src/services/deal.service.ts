import type { UUID } from "node:crypto";
import pool from "../config/database.js";
import { type CreateDealRequest } from "../module/CreateDealRequest.js";
import type { SendMessagesRequest } from "../module/SendMessagesRequest.js";
import { getIO } from "../socket.js";
import type { ReadMessagesRequest } from "../module/ReadMessagesRequest.js";
import { AppError } from "../errors/AppError.js";
import type { CreateChatRoomRequest } from "../module/CreateChatRoomRequest.js";
import { ChatRoomStatus } from "../module/Enum.js";

export async function CreateChatRoom(request: CreateChatRoomRequest): Promise<UUID> {
    const { BuyerId, SellerId } = request;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const room = await client.query(
            `INSERT INTO ct.chat_rooms (buyer_id, seller_id, status)
             VALUES ($1, $2, $3) RETURNING id`,
            [BuyerId, SellerId, ChatRoomStatus.ACTIVE]
        );

        const chatRoomId = room.rows[0].id;

        await client.query(
            `INSERT INTO ct.chat_room_members
                (chat_room_id, user_id, last_read_at)
            VALUES ($1, $2, NOW()),
                   ($1, $3, NOW())`,
            [chatRoomId, BuyerId, SellerId]
        );

        await client.query("COMMIT");

        return chatRoomId;

    } catch (err) {
        await client.query("ROLLBACK");
        throw new AppError("ไม่สามารถสร้างห้องแชทได้ กรุณาลองใหม่อีกครั้ง" + err, 500);
    } finally {
        client.release();
    }
}

export async function SendMessages(request: SendMessagesRequest): Promise<UUID> {
    const { ChatRoomId, SenderId, ContentType, Content } = request;

    const result = await pool.query(
        "INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content) VALUES ($1, $2, $3, $4) RETURNING id",
        [ChatRoomId, SenderId, ContentType, Content]
    );

    const message = result.rows[0];
    const io = getIO();
    io.to(ChatRoomId).emit("new-message", message);

    return message.id;
}

export async function markAsRead(readMessagesRequest: ReadMessagesRequest) {
    const { ChatRoomId, UserId } = readMessagesRequest;

    await pool.query(`UPDATE ct.chat_room_members
                         SET last_read_at = NOW()
                      WHERE chat_room_id = $1 AND user_id = $2`,
                      [ChatRoomId, UserId]);
}

export async function getAllUnread(userId: string) {
    
  const result = await pool.query(`SELECT
                                        m.chat_room_id,
                                        COUNT(*) AS unread_count
                                    FROM ct.messages m
                                    JOIN ct.chat_room_members cm
                                        ON cm.chat_room_id = m.chat_room_id
                                    WHERE cm.user_id = $1
                                        AND m.sender_id != $1
                                        AND m.created_at > cm.last_read_at
                                    GROUP BY m.chat_room_id`,
                                    [userId]);

  return result.rows;
}

export async function getMessages(chatRoomId: string, userId: UUID, cursor?: string) {
    const isHasPermission = await checkPermission(chatRoomId, userId);
    if(!isHasPermission){
        throw new AppError("คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้", 403);
    }

    const PAGE_SIZE = 20;

    const params: any[] = [chatRoomId];
    let cursorCondition = "";

    if (cursor) {
        cursorCondition = `AND created_at < $2`;
        params.push(cursor);
    }

    const result = await pool.query(`SELECT *
                                        FROM ct.view_chat_room_messages
                                    WHERE chat_room_id = $1
                                    ${cursorCondition}
                                    ORDER BY created_at DESC
                                    LIMIT ${PAGE_SIZE}`, params);

    const messages = result.rows.toReversed();

    return {
        messages,
        nextCursor: messages.length > 0 ? messages[0].created_at : null,
        hasMore: messages.length === PAGE_SIZE
    };
}

export async function checkPermission(chatRoomId: string, userId: UUID): Promise<boolean> {
    const result = await pool.query(
        `SELECT user_id
         FROM ct.chat_room_members
         WHERE chat_room_id = $1 AND user_id = $2`,
        [chatRoomId, userId]
    );

    return result.rows.length > 0;
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