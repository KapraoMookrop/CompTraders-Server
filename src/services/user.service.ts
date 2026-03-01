import pool from "../config/database.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { type SignUpDataRequest } from "../module/SignUpDataRequest.js";
import { UserRole, KycStatus, UserStatus, SellerVerificationStatus } from "../module/Enum.js";
import type { UUID } from "node:crypto";
import { ENV } from "../config/env.js";
import { type LoginResponseData } from "../module/LoginResponseData.js";

export async function SignUp(signUpDataRequest: SignUpDataRequest): Promise<UUID> {
  const { FullName, Email, Password, Phone, Role } = signUpDataRequest;

  const existingPhone = await pool.query("SELECT id FROM ct.users WHERE phone = $1", [Phone]);
  if (existingPhone.rows.length > 0) {
    throw new Error("เบอร์โทรศัพท์นี้ถูกลงทะเบียนกับระบบแล้ว");
  }

  const existingEmail = await pool.query("SELECT id FROM ct.users WHERE email = $1", [Email]);
  if (existingEmail.rows.length > 0) {
    throw new Error("อีเมลนี้ถูกลงทะเบียนกับระบบแล้ว");
  }

  const hashedPassword = await bcrypt.hashSync(Password, 10);

  const result = await pool.query(
    "INSERT INTO ct.users (full_name, email, password_hash, phone, role, kyc_status, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    [FullName, Email, hashedPassword, Phone, Role, KycStatus.PENDING, UserStatus.ACTIVE]
  );

  return result.rows[0].id;
}

export async function Login(email: string, password: string): Promise<LoginResponseData> {
  try {
    console.log(`Attempting login for email: ${email} - ${password}`);
    const result = await pool.query(
      "SELECT id, email, full_name, password_hash, phone, role, kyc_status, status FROM ct.users WHERE email = $1",
      [email]
    );

    
    if (result.rows.length === 0) {
      console.log(`Login failed: No user found with email ${email}`);
      throw new Error("อีเมลนี้ยังไม่ได้ลงทะเบียนกับระบบ");
    }
    
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      console.log(`Login failed: Incorrect password for email ${email}`);
      throw new Error("รหัสผ่านไม่ถูกต้อง");
    }

    const token = jwt.sign(
      { userId: user.id, fullName: user.full_name, },
      ENV.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const loginResponseData: LoginResponseData = {
      FullName: user.full_name,
      Email: user.email,
      Phone: user.phone,
      Role: user.role,
      KycStatus: user.kyc_status,
      UserStatus: user.status,
      JWT: token,
    };

    return loginResponseData;
  } catch (error) {
    throw error;
  }
}