import type { UUID } from "node:crypto";
import pool from "../config/database.js";
import type { SendMessagesRequest } from "../module/SendMessagesRequest.js";
// import { getIO } from "../socket.js";
import axios from "axios";
import type { ReadMessagesRequest } from "../module/ReadMessagesRequest.js";
import { AppError } from "../utils/errors/AppError.js";
import type { MessageRequestData } from "../module/MessageRequestData.js";
import type { MessageDataList } from "../module/MessageDataList.js";
import type { MessageData } from "../module/MessageData.js";
import type { ChatRoomData } from "../module/ChatRoomData.js";

export async function SendMessages(request: SendMessagesRequest): Promise<MessageData> {
    const { ChatRoomId, SenderId, ContentType, Content, SenderName } = request;

    const result = await pool.query(
        "INSERT INTO ct.messages (chat_room_id, sender_id, content_type, content) VALUES ($1, $2, $3, $4) RETURNING *",
        [ChatRoomId, SenderId, ContentType, Content]
    );

    const message = result.rows.map((msg) => ({
        Id: msg.id,
        ChatRoomId: msg.chat_room_id,
        SenderId: msg.sender_id,
        SenderName: SenderName,
        SenderRole: msg.sender_role,
        ContentType: msg.content_type,
        Content: msg.content,
        File_Url: msg.file_url,
        File_Type: msg.file_type,
        CreatedAt: msg.created_at
    } as MessageData));

    const members = await pool.query(
        `SELECT user_id FROM ct.chat_room_members WHERE chat_room_id = $1 AND user_id != $2`,
        [ChatRoomId, SenderId]
    );

    // const io = getIO();
    // io.to(ChatRoomId).emit("new-message", message[0]);
    // members.rows.forEach((m) => {
    //     io.to(m.user_id).emit("new-message-notify", message[0]);
    // });
    try {
        await Promise.all(
            members.rows.map((m) =>
                axios.post(process.env.SOCKET_URL + "/emit", {
                    type: "new-message",
                    chatRoomId: ChatRoomId,
                    userId: m.user_id,
                    message: message[0]
                })
            )
        );
    } catch (err) {
        throw new AppError("ส่งข้อความไม่สำเร็จ" + err, 500);
    }

    return message[0]!;
}

export async function MarkAsRead(readMessagesRequest: ReadMessagesRequest) {
    const { ChatRoomId, UserId } = readMessagesRequest;

    await pool.query(`UPDATE ct.chat_room_members
                         SET last_read_at = NOW()
                      WHERE chat_room_id = $1 AND user_id = $2`,
        [ChatRoomId, UserId]);
}

export async function GetAllChatRooms(userId: string): Promise<ChatRoomData[]> {

    const result = await pool.query(`SELECT *
                                        FROM ct.view_chat_room_list
                                     WHERE user_id = $1
                                     ORDER BY last_message_at DESC NULLS LAST;`,
        [userId]);

    const respone = result.rows.map((row) => ({
        ChatRoomId: row.chat_room_id,
        CountUnread: parseInt(row.count_unread) || 0,
        LastMessage: row.last_message,
        LastMessageAt: row.last_message_at,
        UserName: row.full_name,
        UserAvatarUrl: row.user_avatar_url
    } as ChatRoomData));

    return respone;
}

export async function GetMessages(request: MessageRequestData, userId: UUID): Promise<MessageDataList> {
    const { ChatRoomId, Cursor } = request;
    const isHasPermission = await CheckPermission(ChatRoomId, userId);
    if (!isHasPermission) {
        throw new AppError("คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้", 403);
    }

    const PAGE_SIZE = 20;

    const params: any[] = [ChatRoomId];
    let cursorCondition = "";

    if (Cursor) {
        cursorCondition = `AND created_at < $2`;
        params.push(Cursor);
    }

    const resultSQL = await pool.query(`SELECT *
                                        FROM ct.view_chat_room_messages
                                    WHERE chat_room_id = $1
                                    ${cursorCondition}
                                    ORDER BY created_at DESC
                                    LIMIT ${PAGE_SIZE}`, params);

    const messages = resultSQL.rows.toReversed();
    const responseMessages = messages.map((msg) => ({
        Id: msg.message_id,
        ChatRoomId: msg.chat_room_id,
        SenderId: msg.sender_id,
        SenderName: msg.sender_name,
        SenderRole: msg.sender_role,
        ContentType: msg.content_type,
        Content: msg.content,
        File_Url: msg.file_url,
        File_Type: msg.file_type,
        CreatedAt: msg.created_at
    } as MessageData));
    const currentUserName = responseMessages.find(t => t.SenderId == userId)?.SenderName || "";
    const otherUserName = responseMessages.find(t => t.SenderId != userId)?.SenderName || "";

    const result: MessageDataList = {
        Messages: responseMessages,
        NextCursor: messages.length > 0 ? messages[0].created_at : null,
        HasMore: messages.length === PAGE_SIZE,
        CurrentUserName: currentUserName,
        OtherUserName: otherUserName
    }

    return result;
}

async function CheckPermission(chatRoomId: string, userId: UUID): Promise<boolean> {
    const result = await pool.query(
        `SELECT user_id
         FROM ct.chat_room_members
         WHERE chat_room_id = $1 AND user_id = $2`,
        [chatRoomId, userId]
    );

    return result.rows.length > 0;
}