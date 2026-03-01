// enums.ts

export enum UserRole {
  BUYER = "BUYER",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
}

export enum KycStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum SellerVerificationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ChatRoomStatus {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

export enum MessageContentType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
}

export enum DealStatus {
  NEGOTIATING = "NEGOTIATING",
  WAITING_PAYMENT = "WAITING_PAYMENT",
  PAID = "PAID",
  SHIPPING = "SHIPPING",
  DELIVERED = "DELIVERED",
  COMPLETED = "COMPLETED",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
}

export enum EscrowWalletStatus {
  HOLDING = "HOLDING",
  RELEASED = "RELEASED",
  REFUNDED = "REFUNDED",
}

export enum EscrowTransactionType {
  DEPOSIT = "DEPOSIT",
  RELEASE = "RELEASE",
  REFUND = "REFUND",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export enum ShipmentStatus {
  SHIPPED = "SHIPPED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}