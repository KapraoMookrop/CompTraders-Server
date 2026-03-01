import { UserRole, KycStatus, UserStatus, SellerVerificationStatus } from "./Enum.js";

export interface SignUpDataRequest {
    FullName: string;
    Email: string;
    Password: string;
    Phone: string;
    Role: UserRole;
    KycStatus: KycStatus;
    UserStatus: UserStatus;
}
