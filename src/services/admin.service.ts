import path from 'path';
import pool from '../config/database.js';
import { AppError } from "../utils/errors/AppError.js";
import type { SellerData } from '../module/SellerData.js';
import { drive } from '../config/driveConfig.js';

export async function getSellerVerification(): Promise<SellerData[]> {
    const sql = await pool.query(
        `SELECT user_id, id_card_url, selfie_url, status, bank_id, bank_number
         FROM ct.seller_verifications`
    );

    if (sql.rowCount === 0) {
        return [] as SellerData[];
    }

    const result = sql.rows.map((seller) => ({
        SellerId: seller.user_id,
        BankId: seller.bank_id,
        BankNumber: seller.bank_number,
        IdCardImageUrl: seller.id_card_url,
        SelfieImageUrl: seller.selfie_url
    } as SellerData));

    return result
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