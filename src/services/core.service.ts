import pool from "../config/database.js";
import { AppError } from "../utils/errors/AppError.js";
import type { DistrictData } from "../module/DistrictData.js";
import { UserRole, UserStatus, Verify2FAType } from "../module/Enum.js";
import type { LoginResponseData } from "../module/LoginResponseData.js";
import jwt from "jsonwebtoken";
import type { ProvinceData } from "../module/ProvinceData.js";
import type { SubDistrictData } from "../module/SubDistrictData.js";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import speakeasy from "speakeasy";
import bcrypt from "bcrypt";
import { ENV } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { DropDownData } from "../module/DropDownData.js";
import type { NotificationData } from "../module/NotificationData.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function GetProvinces(): Promise<ProvinceData[]> {
    const result = await pool.query(`SELECT * FROM ct.provinces`);

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลจังหวัด", 404);
    }

    const provinces = result.rows.map((row) => ({
        Id: row.id,
        Name_TH: row.name_th,
        Name_EN: row.name_en
    } as ProvinceData));

    return provinces;
}

export async function GetDistricts(provinceId: string): Promise<DistrictData[]> {
    const result = await pool.query(
        `SELECT * FROM ct.districts WHERE province_id = $1`,
        [provinceId]
    );

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลอำเภอสำหรับจังหวัดนี้", 404);
    }

    const districts = result.rows.map((row) => ({
        Id: row.id,
        ProvinceId: row.province_id,
        Name_TH: row.name_th,
        Name_EN: row.name_en
    } as DistrictData));

    return districts;
}

export async function GetSubDistricts(districtId: string): Promise<SubDistrictData[]> {
    const result = await pool.query(
        `SELECT * FROM ct.sub_districts WHERE district_id = $1`,
        [districtId]
    );

    if (result.rowCount === 0) {
        throw new AppError("ไม่พบข้อมูลตำบลสำหรับอำเภอนี้", 404);
    }

    const subDistricts = result.rows.map((row) => ({
        Id: row.id,
        DistrictId: row.district_id,
        Name_TH: row.name_th,
        Name_EN: row.name_en,
        ZipCode: row.zip_code
    } as SubDistrictData));

    return subDistricts;
}

export async function SendVerifyEmail(email: string, token: string) {
    const CoreMail = await GetCoreMail();

    const verification_link = `${ENV.CLIENT_URL}/verify-email/${token}`;
    const replacements: MailTemplateReplacements = {
        header: `<h1 class="logo">SafeTrade</h1>
                 <p style="margin: 10px 0 0; opacity: 0.8; font-weight: 300;">Safe & Secure Computer Marketplace</p>`,
        description: `<h2 class="welcome-text">ยืนยันที่อยู่อีเมลของคุณ</h2>
                      <p class="description">
                            ขอบคุณที่ร่วมเป็นส่วนหนึ่งกับ SafeTrade!<br>
                            อีกเพียงขั้นตอนเดียวเท่านั้น เพื่อเริ่มการซื้อขายที่ปลอดภัย<br>
                            โปรดคลิกที่ปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ
                      </p>`,
        body: `<div class="btn-container">
                    <a href="${verification_link}" class="btn">ยืนยันอีเมลของฉัน</a>
                </div>
                <p style="font-size: 14px; color: #9ca3af;">
                    หากปุ่มด้านบนใช้งานไม่ได้ โปรดคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ:<br>
                    <a href="${verification_link}"
                        style="color: #059669; word-break: break-all;">${verification_link}</a>
                </p>

                <div class="security-note">
                    <strong>ข้อควรระวัง:</strong> หากคุณไม่ได้เป็นผู้สร้างบัญชีนี้
                    โปรดเพิกเฉยต่ออีเมลฉบับนี้ หรือติดต่อฝ่ายสนับสนุนหากมีข้อสงสัย
                </div>`
    }
    var html = GetMailTemplate("email-notify", replacements);

    await CoreMail.transporter.sendMail({
        from: `"Support Safe Trade" <${CoreMail.CoreMailUser}>`,
        to: email,
        subject: "ยืนยันอีเมลของคุณ",
        html: html
    });
}

export async function VerifyEmail(token: string) {
    const result = await pool.query("SELECT id, verify_token_expire FROM ct.users WHERE verify_token = $1", [token]);
    if (result.rows.length === 0) {
        throw new AppError("ลิงก์ยืนยันอีเมลไม่ถูกต้อง", 400);
    }

    const user = result.rows[0];
    const now = new Date();
    if (user.verify_token_expire < now) {
        throw new AppError("ลิงก์ยืนยันอีเมลหมดอายุแล้ว", 400);
    }

    await pool.query(`UPDATE ct.users SET status = '${UserStatus.ACTIVE}', verify_token = null, verify_token_expire = null WHERE id = $1`, [user.id]);
}

export async function Enable2FA(userId: string, email: string) {

    console.log("Enabling 2FA for user:", userId, email);
    const secret = speakeasy.generateSecret({
        length: 20,
        name: "SafeTrade:" + email
    });

    const qr = await QRCode.toDataURL(secret.otpauth_url as string);

    await pool.query(
        `UPDATE ct.users SET twofa_secret = $1 WHERE id = $2`,
        [secret.base32, userId]
    );

    return {
        qr,
        secret: secret.base32
    };
}

export async function Verify2FA(email: string, token: string, type: Verify2FAType) {
    console.log("Verifying 2FA for user:", email, "with token:", token, "and type:", type);
    const sqlSelect = await pool.query(
        `SELECT id, email, full_name, password_hash, phone, role, kyc_status, status, twofa_enabled, twofa_secret FROM ct.users WHERE email = $1`,
        [email]
    );

    if (sqlSelect.rows.length === 0) {
        throw new AppError("ไม่พบผู้ใช้งาน", 404);
    }

    const user = sqlSelect.rows[0];

    const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token: token,
        window: 1
    });

    if (!verified) {
        throw new AppError("รหัส 2FA ไม่ถูกต้อง", 400);
    }

    if (type === Verify2FAType.VERIFYENABLE) {
        await pool.query(
            `UPDATE ct.users SET twofa_enabled = true WHERE id = $1`,
            [user.id]
        );
    } else if (type === Verify2FAType.VERIFYLOGIN) {
        const loginResponseData = await SignJWT(user);
        return loginResponseData;
    } else if (type === Verify2FAType.VERIFY) {
        return true;
    }
    else {
        throw new AppError("ประเภทการยืนยัน 2FA ไม่ถูกต้อง", 400);
    }
}

export async function Disable2FA(userId: string) {
    await pool.query(
        `UPDATE ct.users SET twofa_enabled = false, twofa_secret = null WHERE id = $1`,
        [userId]
    );
}

export async function SignJWT(user: any) {
    const token = jwt.sign(
        {
            userId: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            kycStatus: user.kyc_status,
            userStatus: user.status,
            isEnabled2FA: user.twofa_enabled,
            sellerVerificationStatus: user.seller_verification_status
        },
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
        IsEnabled2FA: user.twofa_enabled,
    };

    return loginResponseData;
}

export async function SendForgotPasswordEmail(email: string) {
    const setTokenResult = await pool.query(
        "UPDATE ct.users SET verify_token = gen_random_uuid(), verify_token_expire = NOW() + INTERVAL '1 hour' WHERE email = $1 RETURNING verify_token",
        [email]
    );
    const CoreMail = await GetCoreMail();

    const verification_link = `${ENV.CLIENT_URL}/change-password/${setTokenResult.rows[0].verify_token}`;
    const replacements: MailTemplateReplacements = {
        header: `<h1 class="logo">SafeTrade</h1>
                <p style="margin: 10px 0 0; opacity: 0.8; font-weight: 300;">Safe & Secure Computer Marketplace</p>`,
        description: `<h2 class="welcome-text">เราได้รับคำขอเปลี่ยนรหัสผ่านจากคุณ</h2>
                      <p class="description">
                        หากคุณไม่ได้ทำการขอเปลี่ยนรหัสผ่านนี้</br>
                        กรุณาอย่าคลิกที่ปุ่มด้านล่างและแจ้งให้เราทราบทันทีเพื่อความปลอดภัยของบัญชีคุณ
                      </p>`,
        body: `<div class="btn-container">
                    <a href="${verification_link}" class="btn">เปลี่ยนรหัสผ่าน</a>
                </div>
                <p style="font-size: 14px; color: #9ca3af;">
                    หากปุ่มด้านบนใช้งานไม่ได้ โปรดคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ:<br>
                    <a href="${verification_link}"
                        style="color: #059669; word-break: break-all;">${verification_link}</a>
                </p>`
    }

    var html = GetMailTemplate("email-notify", replacements);
    await CoreMail.transporter.sendMail({
        from: `"Support Safe Trade" <${CoreMail.CoreMailUser}>`,
        to: email,
        subject: "คำขอเปลี่ยนรหัสผ่าน",
        html: html
    });
}

export async function ChangePassword(token: string, newPassword: string) {
    const result = await pool.query("SELECT id, verify_token_expire FROM ct.users WHERE verify_token = $1", [token]);
    if (result.rows.length === 0) {
        throw new AppError("ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้อง", 400);
    }

    if (result.rows[0].verify_token_expire < new Date()) {
        await pool.query("UPDATE ct.users SET verify_token = NULL, verify_token_expire = NULL WHERE id = $1", [result.rows[0].id]);
        throw new AppError("ลิงก์เปลี่ยนรหัสผ่านหมดอายุแล้ว กรุณาส่งคำร้องใหม่", 400);
    }

    const userId = result.rows[0].id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE ct.users SET password_hash = $1, verify_token = NULL, verify_token_expire = NULL WHERE id = $2", [hashedPassword, userId]);
}

export async function SendMailDeleteAccount(email: string) {
    const setTokenResult = await pool.query(
        "UPDATE ct.users SET verify_token = gen_random_uuid(), verify_token_expire = NOW() + INTERVAL '1 hour' WHERE email = $1 RETURNING verify_token",
        [email]
    );
    const CoreMail = await GetCoreMail();

    const verification_link = `${ENV.CLIENT_URL}/delete-account/${setTokenResult.rows[0].verify_token}`;
    const replacements: MailTemplateReplacements = {
        header: `<h1 class="logo">SafeTrade</h1>
                <p style="margin: 10px 0 0; opacity: 0.8; font-weight: 300;">Safe & Secure Computer Marketplace</p>`,
        description: `<h2 class="welcome-text">คำร้องขอการลบบัญชี</h2>
                      <p class="description">
                        เราได้รับคำขอให้ลบบัญชีที่เชื่อมโยงกับอีเมลนี้ หากคุณไม่ได้ทำการร้องขอนี้<br>
                        กรุณาอย่าคลิกที่ปุ่มด้านล่างและแจ้งให้เราทราบทันทีเพื่อความปลอดภัยของบัญชีคุณ
                      </p>`,
        body: `<div class="btn-container">
                    <a href="${verification_link}" class="btn" style="background-color: #dc3545;">ลบบัญชี</a>
                </div>
                <p style="font-size: 14px; color: #9ca3af;">
                    หากปุ่มด้านบนใช้งานไม่ได้ โปรดคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ:<br>
                    <a href="${verification_link}"
                        style="color: #dc3545; word-break: break-all;">${verification_link}</a>
                </p>`
    }

    var html = GetMailTemplate("email-notify", replacements);
    await CoreMail.transporter.sendMail({
        from: `"Support Safe Trade" <${CoreMail.CoreMailUser}>`,
        to: email,
        subject: "คำร้องขอการลบบัญชี",
        html: html
    });
}

export async function DeleteAccount(token: string) {
    const result = await pool.query("SELECT id, verify_token_expire FROM ct.users WHERE verify_token = $1", [token]);
    if (result.rows.length === 0) {
        throw new AppError("ลิงก์การลบบัญชีไม่ถูกต้อง", 400);
    }

    if (result.rows[0].verify_token_expire < new Date()) {
        await pool.query("UPDATE ct.users SET verify_token = NULL, verify_token_expire = NULL WHERE id = $1", [result.rows[0].id]);
        throw new AppError("ลิงก์การลบบัญชีหมดอายุแล้ว กรุณาส่งคำร้องใหม่", 400);
    }

    const userId = result.rows[0].id;
    await pool.query("DELETE FROM ct.users WHERE id = $1", [userId]);
}

export async function FindUsers(textInput: string, currentUserId: string, currentUserRole: UserRole): Promise<DropDownData[]> {
    const sqlSelect = await pool.query(`SELECT id, email, full_name, phone, role 
                                            FROM ct.users 
                                        WHERE (full_name ILIKE '%' || $1 || '%' OR phone LIKE '%' || $1 || '%')  
                                               AND id != $2 AND role != $3`,
        [textInput, currentUserId, currentUserRole]
    );

    const result = sqlSelect.rows.map((row) => ({
        Id: row.id,
        DisplayText: `${row.full_name}`
    } as DropDownData));

    return result;
}

export async function FindBanks(textInput: string): Promise<DropDownData[]> {
    const sqlSelect = await pool.query(`SELECT id, name_th, name_en
                                            FROM ct.banks 
                                        WHERE (name_th ILIKE '%' || $1 || '%' OR name_en ILIKE '%' || $1 || '%')`,
        [textInput]
    );

    const result = sqlSelect.rows.map((row) => ({
        Id: row.id,
        DisplayText: `${row.name_th}`
    } as DropDownData));

    return result;
}

export async function GetNotifications(userId: string) {
    const sqlNotifications = await pool.query(
        `SELECT id, type, title, message, related_id, is_read, created_at 
            FROM ct.notifications 
        WHERE user_id = $1
        ORDER BY created_at DESC`,
        [userId]
    );

    const result = sqlNotifications.rows.map((row) => ({
        Id: row.id,
        Type: row.type,
        Title: row.title,
        Message: row.message,
        RelatedId: row.related_id,
        IsRead: row.is_read,
        CreatedAt: row.created_at
    } as NotificationData));

    return result;
}

export async function MarkAllNotificationsAsRead(userId: string) {
    await pool.query(
        `UPDATE ct.notifications SET is_read = true WHERE user_id = $1`,
        [userId]
    );
}

function GetMailTemplate(templateName: string, replacements: MailTemplateReplacements) {
    const templatePath = path.join(__dirname, "../mail-template", `${templateName}.html`);
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replaceAll("{{header}}", replacements.header);
    html = html.replaceAll("{{description}}", replacements.description);
    html = html.replaceAll("{{body}}", replacements.body);

    return html;
}

async function GetCoreMail() {
    const sqlCoreMailPassword = await pool.query(
        "select * from ct.configuration where code = 'CoreMailPassword'"
    );
    const CoreMailPassword = sqlCoreMailPassword.rows[0].value;

    const sqlCoreMailUser = await pool.query(
        "select * from ct.configuration where code = 'CoreMailUser'"
    );
    const CoreMailUser = sqlCoreMailUser.rows[0].value;

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: CoreMailUser,
            pass: CoreMailPassword
        }
    });

    return { transporter: transporter, CoreMailUser: CoreMailUser };
}

interface MailTemplateReplacements {
    header: string;
    description: string;
    body: string;
}