import pool from '../../config/database.js';
import { AppError } from "../../utils/errors/AppError.js";
import { drive } from '../../config/driveConfig.js';
import type { DealSearchCriteria } from '../../module/DealSearchCriteria.js';
import type { DealAdminData } from '../../module/DealAdminData.js';
import type { ResponseData } from '../../module/ResponseData.js';
import { DealStatus, PaymentStatus } from '../../module/Enum.js';

export async function FindAsync(criteria: DealSearchCriteria): Promise<ResponseData<DealAdminData>> {
    const page = criteria.Page ?? 1;
    const pageSize = criteria.PageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const sortByMap: Record<string, string> = {
        Title: "d.title",
        Amount: "d.amount",
        Status: "d.status",
        CreatedAt: "d.created_at"
    };

    const sortColumn = sortByMap[criteria.SortBy] || "d.created_at";
    const sortDirection = criteria.SortDirection === "ASC" ? "ASC" : "DESC";

    const { where, params } = BuildWhereClause(criteria);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countParams = [...params];

    params.push(pageSize);
    params.push(offset);

    const dataQuery = `
    SELECT 
        d.id,
        d.chat_room_id,
        d.buyer_id,
        ub.full_name as buyer_name,
        d.seller_id,
        us.full_name as seller_name,
        d.title,
        d.description,
        d.amount,
        d.status,
        d.created_at,
        p.id as payment_id,
        p.status as payment_status,
        ps.slip_url
    FROM ct.deals d
    LEFT JOIN ct.users ub ON d.buyer_id = ub.id
    LEFT JOIN ct.users us ON d.seller_id = us.id
    LEFT JOIN ct.payments p ON d.id = p.deal_id
    LEFT JOIN ct.payment_slips ps ON p.id = ps.payment_id
    ${whereSql}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const dataResult = await pool.query(dataQuery, params);

    const countQuery = `
    SELECT COUNT(*)
    FROM ct.deals d
    LEFT JOIN ct.users ub ON d.buyer_id = ub.id
    LEFT JOIN ct.users us ON d.seller_id = us.id
    ${whereSql}`;
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const data = dataResult.rows.map((row) => ({
        Id: row.id,
        ChatRoomId: row.chat_room_id,
        BuyerId: row.buyer_id,
        BuyerName: row.buyer_name,
        SellerId: row.seller_id,
        SellerName: row.seller_name,
        Title: row.title,
        Description: row.description,
        Amount: Number(row.amount),
        Status: row.status,
        CreatedAt: row.created_at,
        PaymentId: row.payment_id || undefined,
        PaymentStatus: row.payment_status || undefined,
        SlipUrl: row.slip_url || undefined
    } as DealAdminData));

    return {
        Data: data,
        TotalCount: total
    };
}

function BuildWhereClause(criteria: DealSearchCriteria): { where: string[], params: any[] } {
    let where: string[] = [];
    let params: any[] = [];
    let index = 1;

    if (criteria.Title) {
        where.push(`d.title ILIKE $${index}`);
        params.push(`%${criteria.Title}%`);
        index++;
    }

    if (criteria.SellerName) {
        where.push(`us.full_name ILIKE $${index}`);
        params.push(`%${criteria.SellerName}%`);
        index++;
    }

    if (criteria.BuyerName) {
        where.push(`ub.full_name ILIKE $${index}`);
        params.push(`%${criteria.BuyerName}%`);
        index++;
    }

    if (criteria.DealStatus) {
        where.push(`d.status = $${index}`);
        params.push(criteria.DealStatus);
        index++;
    }

    return { where, params };
}

export async function GetDealByIdAsync(dealId: string): Promise<DealAdminData> {
    const result = await pool.query(
        `SELECT 
            d.id,
            d.chat_room_id,
            d.buyer_id,
            ub.full_name as buyer_name,
            d.seller_id,
            us.full_name as seller_name,
            d.title,
            d.description,
            d.amount,
            d.status,
            d.created_at,
            p.id as payment_id,
            p.status as payment_status,
            ps.slip_url
         FROM ct.deals d
         LEFT JOIN ct.users ub ON d.buyer_id = ub.id
         LEFT JOIN ct.users us ON d.seller_id = us.id
         LEFT JOIN ct.payments p ON d.id = p.deal_id
         LEFT JOIN ct.payment_slips ps ON p.id = ps.payment_id
         WHERE d.id = $1`,
        [dealId]
    );

    if (result.rowCount === 0) {
        throw new AppError('ไม่พบข้อมูลดีล', 404);
    }

    const row = result.rows[0];
    let slipImageBase64: string | undefined = undefined;

    if (row.slip_url) {
        try {
            const driveResponse = await drive.files.get(
                { fileId: row.slip_url, alt: 'media' },
                { responseType: 'stream' }
            );
            const chunks: any[] = [];
            for await (const chunk of driveResponse.data) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            slipImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (err) {
            console.error("Failed to load slip image from Drive for Admin:", err);
        }
    }

    return {
        Id: row.id,
        ChatRoomId: row.chat_room_id,
        BuyerId: row.buyer_id,
        BuyerName: row.buyer_name,
        SellerId: row.seller_id,
        SellerName: row.seller_name,
        Title: row.title,
        Description: row.description,
        Amount: Number(row.amount),
        Status: row.status,
        CreatedAt: row.created_at,
        PaymentId: row.payment_id || undefined,
        PaymentStatus: row.payment_status || undefined,
        SlipUrl: row.slip_url || undefined,
        SlipImageBase64: slipImageBase64
    };
}

export async function ConfirmPayment(dealId: string): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. อัปเดตสถานะ Payment เป็น CONFIRMED และอัปเดต confirmed_at
        await client.query(
            `UPDATE ct.payments
             SET status = $2, confirmed_at = NOW()
             WHERE deal_id = $1`,
            [dealId, PaymentStatus.CONFIRMED]
        );

        // 2. อัปเดตสถานะดีลใน ct.deals เป็น PAID
        await client.query(
            `UPDATE ct.deals
             SET status = $2, paid_at = NOW()
             WHERE id = $1`,
            [dealId, DealStatus.PAID]
        );

        // ดึงข้อมูลดีลเพื่อนำไปใส่ Escrow Wallet
        const dealResult = await client.query(
            `SELECT amount FROM ct.deals WHERE id = $1`,
            [dealId]
        );
        if (dealResult.rowCount === 0) {
            throw new AppError('ไม่พบข้อมูลดีล', 404);
        }
        const amount = Number(dealResult.rows[0].amount);

        // 3. สร้าง Escrow Wallet (สถานะ HOLDING)
        const walletResult = await client.query(
            `INSERT INTO ct.escrow_wallets (deal_id, balance, status)
             VALUES ($1, $2, 'HOLDING') RETURNING id`,
            [dealId, amount]
        );
        const walletId = walletResult.rows[0].id;

        // 4. บันทึก Escrow Transaction (ประเภท DEPOSIT)
        await client.query(
            `INSERT INTO ct.escrow_transactions (wallet_id, type, amount)
             VALUES ($1, 'DEPOSIT', $2)`,
            [walletId, amount]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw new AppError(`เกิดข้อผิดพลาดในการยืนยันยอดเงินเข้าระบบ Escrow: ${error}`, 500);
    } finally {
        client.release();
    }
}
