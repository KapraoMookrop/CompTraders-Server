import { MessageContentType } from "./Enum.js";

export interface SendMessagesRequest {
    ChatRoomId: string;
    SenderId: string;
    ContentType: MessageContentType;
    Content: string;
}
