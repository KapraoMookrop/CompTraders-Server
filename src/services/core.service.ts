import pool from "../config/database.js";
import { AppError } from "../errors/AppError.js";
import type { DistrictData } from "../module/DistrictData.js";
import { UserStatus } from "../module/Enum.js";
import type { ProvinceData } from "../module/ProvinceData.js";
import type { SubDistrictData } from "../module/SubDistrictData.js";
import nodemailer from "nodemailer";

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

    const verification_link = `https://safe-trade-server.vercel.app/verify-email/${token}`;

    await transporter.sendMail({
        from: `"Support Safe Trade" <${CoreMailUser}>`,
        to: email,
        subject: "ยืนยันอีเมลของคุณ",
        html: `
      <!DOCTYPE html>
      <html lang="th">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ยืนยันอีเมลของคุณ - CompTraders</title>
          <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
              /* Reset สำหรับ Email Client */
              body {
                  margin: 0;
                  padding: 0;
                  background-color: #f9fafb;
                  font-family: 'Kanit', Helvetica, Arial, sans-serif;
                  -webkit-font-smoothing: antialiased;
              }
              table {
                  border-spacing: 0;
                  width: 100%;
              }
              td {
                  padding: 0;
              }
              img {
                  border: 0;
              }

              /* Container หลัก */
              .wrapper {
                  width: 100%;
                  table-layout: fixed;
                  background-color: #f9fafb;
                  padding-bottom: 40px;
              }

              .main-content {
                  background-color: #ffffff;
                  margin: 0 auto;
                  width: 100%;
                  max-width: 600px;
                  border-spacing: 0;
                  color: #28312a;
                  border-radius: 32px;
                  overflow: hidden;
                  margin-top: 40px;
                  box-shadow: 0 10px 25px rgba(5, 150, 105, 0.05);
              }

              /* Header พื้นที่สีเขียว */
              .header {
                  background-color: #059669;
                  padding: 40px 20px;
                  text-align: center;
                  color: #ffffff;
              }

              .logo {
                  font-size: 28px;
                  font-weight: 700;
                  letter-spacing: -1px;
                  margin: 0;
              }

              /* Body ของอีเมล */
              .body-section {
                  padding: 40px 30px;
                  text-align: center;
              }

              .welcome-text {
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  color: #059669;
              }

              .description {
                  font-size: 16px;
                  color: #4b5563;
                  line-height: 1.6;
                  margin-bottom: 32px;
              }

              /* ปุ่มยืนยัน */
              .btn-container {
                  margin-bottom: 32px;
              }

              .btn {
                  background-color: #059669;
                  color: #ffffff !important;
                  padding: 16px 40px;
                  text-decoration: none;
                  font-size: 18px;
                  font-weight: 600;
                  border-radius: 20px;
                  display: inline-block;
                  transition: background-color 0.3s ease;
              }

              /* Footer */
              .footer {
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #9ca3af;
              }

              .footer a {
                  color: #059669;
                  text-decoration: none;
              }

              .security-note {
                  background-color: #f3f4f6;
                  padding: 15px;
                  border-radius: 16px;
                  font-size: 13px;
                  color: #6b7280;
                  margin-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="wrapper">
              <table class="main-content">
                  <tr>
                      <td class="header">
                          <h1 class="logo">SafeTrade</h1>
                          <p style="margin: 10px 0 0; opacity: 0.8; font-weight: 300;">Safe & Secure Computer Marketplace</p>
                      </td>
                  </tr>
                  <tr>
                      <td class="body-section">
                          <h2 class="welcome-text">ยืนยันที่อยู่อีเมลของคุณ</h2>
                          <p class="description">
                              ขอบคุณที่ร่วมเป็นส่วนหนึ่งกับ SafeTrade!<br>
                              อีกเพียงขั้นตอนเดียวเท่านั้น เพื่อเริ่มการซื้อขายที่ปลอดภัย<br>
                              โปรดคลิกที่ปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ
                          </p>

                          <div class="btn-container">
                              <!-- เปลี่ยน URL เป็นลิงก์จริงของระบบคุณ -->
                              <a href="${verification_link}" class="btn">ยืนยันอีเมลของฉัน</a>
                          </div>

                          <p style="font-size: 14px; color: #9ca3af;">
                              หากปุ่มด้านบนใช้งานไม่ได้ โปรดคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ:<br>
                              <a href="${verification_link}" style="color: #059669; word-break: break-all;">${verification_link}</a>
                          </p>

                          <div class="security-note">
                              <strong>ข้อควรระวัง:</strong> หากคุณไม่ได้เป็นผู้สร้างบัญชีนี้ 
                              โปรดเพิกเฉยต่ออีเมลฉบับนี้ หรือติดต่อฝ่ายสนับสนุนหากมีข้อสงสัย
                          </div>
                      </td>
                  </tr>
              </table>
          </div>
      </body>
      </html>`
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