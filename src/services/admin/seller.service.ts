import path from 'path';
import pool from '../../config/database.js';
import { AppError } from "../../utils/errors/AppError.js";
import type { SellerData } from '../../module/SellerData.js';
import { drive } from '../../config/driveConfig.js';
import type { SellerSearchCriteria } from '../../module/SellerSearchCriteria.js';
import type { ResponseData } from '../../module/ResponseData.js';

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
        u.phone
    FROM ct.seller_verifications as sv
    LEFT JOIN ct.users as u ON sv.user_id = u.id
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


export async function getIdCardImagePath(sellerId: string) {
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

    return idCard.data
}

export async function getSelfieImagePath(sellerId: string) {
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

    return selfie.data;
}