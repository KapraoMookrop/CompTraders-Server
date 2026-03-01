import { UserRole, KycStatus, UserStatus, SellerVerificationStatus } from "./Enum.js";

export interface LoginResponseData {
    FullName: string;
    Email: string;
    Phone: string;
    Role: UserRole;
    KycStatus: KycStatus;
    UserStatus: UserStatus;
    JWT: string;
}
