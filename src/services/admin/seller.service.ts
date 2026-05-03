import path from 'path';
import pool from '../../config/database.js';
import { AppError } from "../../utils/errors/AppError.js";
import type { SellerData } from '../../module/SellerData.js';
import { drive } from '../../config/driveConfig.js';
import type { SellerSearchCriteria } from '../../module/SellerSearchCriteria.js';
import type { ResponseData } from '../../module/ResponseData.js';
import { KycStatus, SellerVerificationStatus } from '../../module/Enum.js';
import * as Core from "../core.service.js";
import type { MailTemplateReplacements } from '../../module/MailTemplateReplacements.js';

export async function FindAsync(criteria: SellerSearchCriteria): Promise<ResponseData<SellerData>> {

    const page = criteria.Page ?? 1;
    const pageSize = criteria.PageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const sortByMap: Record<string, string> = {
        FullName: "u.full_name",
        Email: "u.email",
        Phone: "u.phone",
        SellerStatus: "sv.status",
        UserId: "sv.user_id"
    };

    const sortColumn = sortByMap[criteria.SortBy] || "sv.user_id";
    const sortDirection = criteria.SortDirection === "ASC" ? "ASC" : "DESC";

    const { where, params } = BuildWhereClause(criteria);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(pageSize);
    params.push(offset);

    const dataQuery = `
    SELECT 
        sv.user_id, 
        sv.id_card_url, 
        sv.selfie_url, 
        sv.status, 
        sv.bank_id, 
        sv.bank_number,
        u.full_name,
        u.email,
        u.phone,
        b.name_th as bank_name
    FROM ct.seller_verifications as sv
    LEFT JOIN ct.users as u ON sv.user_id = u.id
    LEFT JOIN ct.banks as b ON sv.bank_id = b.id
    ${whereSql}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const dataResult = await pool.query(dataQuery, params);

    const countQuery = `SELECT COUNT(*)
        FROM ct.seller_verifications as sv
        LEFT JOIN ct.users as u ON sv.user_id = u.id
        ${whereSql}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const data = dataResult.rows.map((seller) => ({
        UserId: seller.user_id,
        FullName: seller.full_name,
        Email: seller.email,
        Phone: seller.phone,
        SellerStatus: seller.status,
        BankId: seller.bank_id,
        BankNumber: seller.bank_number,
        BankName: seller.bank_name,
        IdCardImageUrl: seller.id_card_url,
        SelfieImageUrl: seller.selfie_url
    } as SellerData));

    const result: ResponseData<SellerData> = {
        Data: data,
        TotalCount: total
    };

    return result
}

function BuildWhereClause(criteria: SellerSearchCriteria): { where: string[], params: any[] } {

    let where: string[] = [];
    let params: any[] = [];
    let index = 1;

    if (criteria.FullName) {
        where.push(`u.full_name ILIKE $${index}`);
        params.push(`%${criteria.FullName}%`);
        index++;
    }

    if (criteria.Email) {
        where.push(`u.email ILIKE $${index}`);
        params.push(`%${criteria.Email}%`);
        index++;
    }

    if (criteria.Phone) {
        where.push(`u.phone ILIKE $${index}`);
        params.push(`%${criteria.Phone}%`);
        index++;
    }

    if (criteria.SellerStatus) {
        where.push(`sv.status = $${index}`);
        params.push(criteria.SellerStatus);
        index++;
    }

    return { where, params };
}


export async function GetSellerByIdAsync(userId: string) {
    const result = await pool.query(
        `SELECT 
        sv.user_id, 
        sv.id_card_url, 
        sv.selfie_url, 
        sv.status, 
        sv.bank_id, 
        sv.bank_number,
        u.full_name,
        u.email,
        u.phone,
        b.name_th as bank_name
    FROM ct.seller_verifications as sv
    LEFT JOIN ct.users as u ON sv.user_id = u.id
    LEFT JOIN ct.banks as b ON sv.bank_id = b.id
    WHERE sv.user_id = $1`, [userId]);

    if (result.rowCount === 0) {
        throw new AppError('ไม่พบข้อมูลผู้ขาย', 404);
    }

    const seller = result.rows[0];
    const idCardImage = await getIdCardImagePath(seller.user_id);
    const selfieImage = await getSelfieImagePath(seller.user_id);

    const sellerData: SellerData = {
        UserId: seller.user_id,
        FullName: seller.full_name,
        Email: seller.email,
        Phone: seller.phone,
        SellerStatus: seller.status,
        BankId: seller.bank_id,
        BankNumber: seller.bank_number,
        BankName: seller.bank_name,
        IdCardImage: idCardImage,
        SelfieImage: selfieImage,
    } as SellerData;

    return sellerData;
}

async function getIdCardImagePath(sellerId: string) {
    const result = await pool.query(
        `SELECT id_card_url FROM ct.seller_verifications WHERE user_id = $1`,
        [sellerId]
    );

    if (result.rowCount === 0) {
        throw new AppError('ไม่พบรูปบัตรประชาชน', 404);
    }

    const idCardId = result.rows[0].id_card_url;
    const idCard = await drive.files.get(
        { fileId: idCardId, alt: 'media' },
        { responseType: 'stream' }
    );

    const chunks = [];
    for await (const chunk of idCard.data) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function getSelfieImagePath(sellerId: string) {
    const result = await pool.query(
        `SELECT selfie_url FROM ct.seller_verifications WHERE user_id = $1`,
        [sellerId]
    );

    if (result.rowCount === 0) {
        throw new AppError('ไม่พบรูป selfie', 404);
    }

    const selfieId = result.rows[0].selfie_url;
    const selfie = await drive.files.get(
        { fileId: selfieId, alt: 'media' },
        { responseType: 'stream' }
    );

    const chunks = [];
    for await (const chunk of selfie.data) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

export async function ApproveSellerAsync(userId: string) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE ct.seller_verifications SET status = $2 WHERE user_id = $1 RETURNING user_id`,
            [userId, SellerVerificationStatus.APPROVED]
        );

        const resultUserEmail = await client.query(
            `UPDATE ct.users SET kyc_status = $2 WHERE id = $1 RETURNING email`,
            [userId, KycStatus.VERIFIED]
        );

        await SendMail(resultUserEmail.rows[0].email, SellerVerificationStatus.APPROVED);

    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการอนุมัติผู้ขาย: ${error}`, 500);
    } finally {
        await client.query("COMMIT");
        client.release();
    }
}

export async function RejectSellerAsync(userId: string, comment: string) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE ct.seller_verifications SET status = $2, comment = $3 WHERE user_id = $1 RETURNING user_id`,
            [userId, SellerVerificationStatus.REJECTED, comment]
        );

        const resultUserEmail = await client.query(
            `UPDATE ct.users SET kyc_status = $2 WHERE id = $1 RETURNING email`,
            [userId, KycStatus.REJECTED]
        );

        await SendMail(resultUserEmail.rows[0].email, SellerVerificationStatus.REJECTED, comment);

    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการปฏิเสธผู้ขาย: ${error}`, 500);
    } finally {
        await client.query("COMMIT");
        client.release();
    }
}

async function SendMail(email: string, type: SellerVerificationStatus, comment?: string) {
    const CoreMail = await Core.GetCoreMail();

    const isApproved = type === SellerVerificationStatus.APPROVED;
    const subject = isApproved ? "ผลการสมัครเป็นผู้ขาย: อนุมัติการสมัคร" : "ผลการสมัครเป็นผู้ขาย: ไม่ผ่านการอนุมัติ";

    const replacements: MailTemplateReplacements = {
        header: `<h1 class="logo">SafeTrade</h1>
                <p style="margin: 10px 0 0; opacity: 0.8; font-weight: 300;">Safe & Secure Computer Marketplace</p>`,
        description: isApproved
            ? `<h2 class="welcome-text">ยินดีด้วย! บัญชีผู้ขายของคุณได้รับการอนุมัติแล้ว</h2>
               <p class="description">
                 ขณะนี้คุณสามารถเริ่มต้นการสร้างดีลและขายสินค้าใน SafeTrade ได้แล้ว
               </p>`
            : `<h2 class="welcome-text" style="color: #ef4444;">แจ้งผลการพิจารณาการสมัครผู้ขาย</h2>
               <p class="description">
                 ขออภัย เนื่องจากข้อมูลที่ท่านส่งมายังไม่ผ่านเกณฑ์การตรวจสอบจากทีมงาน 
                 เนื่องจาก ${comment ?? "ข้อมูลไม่ครบถ้วนหรือไม่ชัดเจน"} <br>
                 <br>หากมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม กรุณาติดต่อทีมงาน SafeTrade ผ่านทางอีเมลหรือช่องทางการติดต่อที่ระบุไว้ในเว็บไซต์ของเรา
               </p>`,
        body: `<div class="btn-container"></div>
                <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">
                    ขอบคุณที่ไว้วางใจใช้บริการ SafeTrade Marketplace
                </p>`
    }

    var html = Core.GetMailTemplate("email-notify", replacements);
    await CoreMail.transporter.sendMail({
        from: `"SafeTrade Support" <${CoreMail.CoreMailUser}>`,
        to: email,
        subject: subject,
        html: html
    });
}
