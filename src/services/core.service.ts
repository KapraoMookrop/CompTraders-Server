import pool from "../config/database.js";
import { AppError } from "../errors/AppError.js";
import type { DistrictData } from "../module/DistrictData.js";
import { UserStatus, Verify2FAType } from "../module/Enum.js";
import type { LoginResponseData } from "../module/LoginResponseData.js";
import jwt from "jsonwebtoken";
import type { ProvinceData } from "../module/ProvinceData.js";
import type { SubDistrictData } from "../module/SubDistrictData.js";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import speakeasy from "speakeasy";
import { ENV } from "../config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
    var html = GetMailTemplate("verify-email", replacements);

    await transporter.sendMail({
        from: `"Support Safe Trade" <${CoreMailUser}>`,
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

    console.log("Secret for 2FA:", secret.base32);

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
        throw new AppError("รหัส 2FA ไม่ถูกต้อง", 401);
    }

    if (type === Verify2FAType.VERIFYENABLE) {
        await pool.query(
            `UPDATE ct.users SET twofa_enabled = true WHERE id = $1`,
            [user.id]
        );
    } else if (type === Verify2FAType.VERIFYLOGIN) {
        const loginResponseData = await SignJWT(user);
        return loginResponseData;
    } else {
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

function GetMailTemplate(templateName: string, replacements: MailTemplateReplacements) {
    const templatePath = path.join(__dirname, "../mail-template", `${templateName}.html`);
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replaceAll("{{header}}", replacements.header);
    html = html.replaceAll("{{description}}", replacements.description);
    html = html.replaceAll("{{body}}", replacements.body);

    return html;
}

interface MailTemplateReplacements {
    header: string;
    description: string;
    body: string;
}