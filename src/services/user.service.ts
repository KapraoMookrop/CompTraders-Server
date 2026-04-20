import pool from "../config/database.js";
import bcrypt from "bcrypt";
import { type SignUpDataRequest } from "../module/SignUpDataRequest.js";
import { KycStatus, UserStatus, UserRole } from "../module/Enum.js";
import type { UUID } from "node:crypto";
import { type LoginResponseData } from "../module/LoginResponseData.js";
import { AppError } from "../utils/errors/AppError.js";
import * as Core from "./core.service.js";
import type { UserLoginDataRequest } from "../module/UserLoginDataRequest.js";
import type { ApplySellerRequestData } from "../module/ApplySellerRequestData.js";
import { uploadFileToDrive } from "../utils/drive-upload/GoogleDrive.js";

export async function SignUp(request: SignUpDataRequest): Promise<UUID> {
  const { FullName, Email, Password, Phone, AddressInfo, ProvinceId, DistrictId, SubDistrictId, ZipCode } = request;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingPhone = await client.query("SELECT id FROM ct.users WHERE phone = $1", [Phone]);
    if (existingPhone.rows.length > 0) {
      throw new AppError("เบอร์โทรศัพท์นี้ถูกลงทะเบียนกับระบบแล้ว", 409);
    }

    const existingEmail = await client.query("SELECT id FROM ct.users WHERE email = $1", [Email]);
    if (existingEmail.rows.length > 0) {
      throw new AppError("อีเมลนี้ถูกลงทะเบียนกับระบบแล้ว", 409);
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    const insertUserResult = await client.query(
      `INSERT INTO ct.users 
      (full_name, email, password_hash, phone, role, kyc_status, status) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, verify_token`,
      [FullName, Email, hashedPassword, Phone, UserRole.BUYER, KycStatus.PENDING, UserStatus.PENDING_VERIFICATION]
    );

    await client.query(
      `INSERT INTO ct.user_addresses 
      (user_id, full_name, phone, address_info, province_id, district_id, sub_district_id, zip_code, is_default) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [insertUserResult.rows[0].id, FullName, Phone, AddressInfo, ProvinceId, DistrictId, SubDistrictId, ZipCode, true]
    );

    await Core.SendVerifyEmail(Email, insertUserResult.rows[0].verify_token);

    await client.query("COMMIT");

    return insertUserResult.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw new AppError(error as string, 500);
  } finally {
    client.release();
  }
}

export async function Login(request: UserLoginDataRequest): Promise<LoginResponseData> {
  const { Email, Password } = request
  const result = await pool.query(
    "SELECT id, email, full_name, password_hash, phone, role, kyc_status, status, twofa_enabled, twofa_secret FROM ct.users WHERE email = $1",
    [Email]
  );

  if (result.rows.length === 0) {
    throw new AppError("อีเมลนี้ยังไม่ได้ลงทะเบียนกับระบบ", 404);
  }

  const user = result.rows[0];


  if (user.status === UserStatus.PENDING_VERIFICATION) {
    throw new AppError("บัญชีของคุณกำลังรอการยืนยันตัวตน กรุณาเช็คอีเมลที่ได้ลงทะเบียนไว้กับระบบ", 403);
  }

  const isPasswordValid = await bcrypt.compare(Password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError("รหัสผ่านไม่ถูกต้อง", 401);
  }

  if (user.twofa_enabled) {
    return {
      IsEnabled2FA: true,
    } as LoginResponseData;
  }

  const loginResponseData = await Core.SignJWT(user);

  return loginResponseData;
}

export async function CheckAlreadyExistsEmail(email: string): Promise<boolean> {
  const result = await pool.query("SELECT id FROM ct.users WHERE email = $1", [email]);

  if (result.rows.length > 0) {
    throw new AppError("อีเมลนี้ถูกลงทะเบียนกับระบบแล้ว", 409);
  }

  return false;
}

export async function ApplySeller(userId: string, userFullName: string, request: ApplySellerRequestData) {
  try {
    const { IdCardImage, SelfieImage, BankId, BankNumber } = request;
    const configFolderId = await pool.query("SELECT value FROM ct.configuration WHERE code = 'GoogleDriveFolderId'");
    if (configFolderId.rows.length === 0) {
      throw new AppError("ไม่พบการตั้งค่าโฟลเดอร์บน Google Drive กรุณาติดต่อผู้ดูแลระบบ", 500);
    }
    const FOLDER_ID = configFolderId.rows[0].value;

    const idCard = await uploadFileToDrive(IdCardImage, `idCard_${userId}_${Date.now()}.jpg`, FOLDER_ID, userFullName);
    const selfie = await uploadFileToDrive(SelfieImage, `selfie_${userId}_${Date.now()}.jpg`, FOLDER_ID, userFullName);

    await pool.query(
      `INSERT INTO ct.seller_verifications 
      (user_id, id_card_url, selfie_url, status, bank_id, bank_number) 
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, idCard.id, selfie.id, 'PENDING', BankId, BankNumber]
    );

  } catch (error) {
    throw new AppError(`เกิดข้อผิดพลาดในการส่งคำขอ: ${error}`, 500);
  }
}