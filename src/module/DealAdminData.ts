export interface DealAdminData {
    Id: string;
    ChatRoomId: string;
    BuyerId: string;
    BuyerName: string;
    SellerId: string;
    SellerName: string;
    Title: string;
    Description: string;
    Amount: number;
    Status: string;
    CreatedAt: Date;
    PaymentId?: string | undefined;
    PaymentStatus?: string | undefined;
    SlipUrl?: string | undefined;
    SlipImageBase64?: string | undefined;
    Carrier?: string | undefined;
    TrackingNumber?: string | undefined;
    PackageImageUrl?: string | undefined;
    PackageImageBase64?: string | undefined;
}
