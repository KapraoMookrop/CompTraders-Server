import type { MessageData } from "./MessageData.js";

export interface ActiveDealData {
    Id: string;
    ChatRoomId: string;
    BuyerId: string;
    SellerId: string;
    Title: string;
    Description: string;
    Amount: number;
    Status: string;
    PaymentId?: string | undefined;
    PaymentStatus?: string | undefined;
    SlipUrl?: string | undefined;
    SlipImageBase64?: string | undefined;
    Carrier?: string | undefined;
    TrackingNumber?: string | undefined;
    ShipmentStatus?: string | undefined;
    PackageImageUrl?: string | undefined;
    PackageImageBase64?: string | undefined;
}

export interface MessageDataList {
    Messages: MessageData[];
    NextCursor: Date;
    HasMore: boolean;
    CurrentUserName: string;
    OtherUserName: string;
    OtherUserId?: string | undefined;
    ActiveDeal?: ActiveDealData | undefined;
}