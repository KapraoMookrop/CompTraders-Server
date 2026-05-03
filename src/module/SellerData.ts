import type { SellerVerificationStatus } from "./Enum.js";

export interface SellerData {
    UserId: string;
    FullName: string;
    Email: string;
    Phone: string;
    SellerStatus: SellerVerificationStatus;
    BankId: string;
    BankName: string;
    BankNumber: string;
    IdCardImageUrl: string;
    SelfieImageUrl: string;
    IdCardImage: any;
    SelfieImage: any;
    ReviewedBy: string;
}