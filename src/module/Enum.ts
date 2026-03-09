//  Role ของผู้ใช้ในระบบ
export enum UserRole {
  BUYER = "BUYER",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
}

// สถานะการยืนยันตัวตน (KYC)
export enum KycStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
}

// สถานะบัญชีผู้ใช้
export enum UserStatus {
  ACTIVE = "ACTIVE",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  SUSPENDED = "SUSPENDED",
}

// สถานะคำขอเป็น Seller
export enum SellerVerificationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

// สถานะห้องแชท
export enum ChatRoomStatus {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

// ประเภทของ message
export enum MessageContentType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
}

// สถานะของ Deal (สำคัญมากสำหรับ Escrow flow)
export enum DealStatus {
  // กำลังเจรจา ยังไม่ตกลงราคา 
  NEGOTIATING = "NEGOTIATING",
  // ตกลงแล้ว รอ Buyer ชำระเงินเข้า Escrow 
  WAITING_PAYMENT = "WAITING_PAYMENT",
  // Buyer ชำระเงินแล้ว เงินอยู่ใน Escrow 
  PAID = "PAID",
  // Seller ส่งสินค้าแล้ว 
  SHIPPING = "SHIPPING",
  // Buyer ได้รับสินค้าแล้ว (รอยืนยัน หรือ auto-release) 
  DELIVERED = "DELIVERED",
  // Deal เสร็จสมบูรณ์ เงินถูกโอนให้ Seller 
  COMPLETED = "COMPLETED",
  // มี dispute เกิดขึ้น ระบบ hold เงิน 
  DISPUTED = "DISPUTED",
  // Refund ให้ Buyer แล้ว 
  REFUNDED = "REFUNDED",
}

// สถานะของ Escrow Wallet
export enum EscrowWalletStatus {
  // เงินอยู่ในระบบ Escrow กำลัง hold 
  HOLDING = "HOLDING",
  // เงินถูกโอนให้ Seller แล้ว 
  RELEASED = "RELEASED",
  // เงินถูกคืนให้ Buyer แล้ว 
  REFUNDED = "REFUNDED",
}


// ประเภทของ Escrow Transaction
export enum EscrowTransactionType {
  // Buyer ฝากเงินเข้า Escrow 
  DEPOSIT = "DEPOSIT",
  // ระบบโอนเงินให้ Seller 
  RELEASE = "RELEASE",
  // ระบบคืนเงินให้ Buyer 
  REFUND = "REFUND",
}

// สถานะการชำระเงิน
export enum PaymentStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

// สถานะการจัดส่งสินค้า
export enum ShipmentStatus {
  SHIPPED = "SHIPPED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
}

// สถานะ dispute
export enum DisputeStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}

// ประเภทของการยืนยัน 2FA
export enum Verify2FAType {
  VERIFYLOGIN = "VERIFYLOGIN",
  VERIFYENABLE = "VERIFYENABLE",
}