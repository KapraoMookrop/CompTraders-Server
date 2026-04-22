import type { KycStatus, SellerVerificationStatus, UserRole, UserStatus } from "./Enum.js";

export interface UserClientData {
    FullName: string;
    Email: string;
    Phone: string;
    Role: UserRole;
    KycStatus: KycStatus;
    UserStatus: UserStatus;
    IsEnabled2FA: boolean;
    SellerVerificationStatus: SellerVerificationStatus;
}
