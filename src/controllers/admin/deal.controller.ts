import { type NextFunction, type Request, type Response } from "express";
import * as adminDealService from "../../services/admin/deal.service.js";

export async function FindAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await adminDealService.FindAsync(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function GetDealByIdAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.query;
    const deal = await adminDealService.GetDealByIdAsync(id as string);
    res.json(deal);
  } catch (error) {
    next(error);
  }
}

export async function ConfirmPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { dealId } = req.body;
    await adminDealService.ConfirmPayment(dealId);
    res.json({ message: "ยืนยันยอดเงินเข้าระบบ Escrow สำเร็จ สถานะอัปเดตเป็น PAID เรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}

export async function ReleaseEscrow(req: Request, res: Response, next: NextFunction) {
  try {
    const { dealId } = req.body;
    await adminDealService.ReleaseEscrow(dealId);
    res.json({ message: "ดำเนินการโอนเงินให้ผู้ขายสำเร็จ ดีลถูกปิดเสร็จสิ้นเรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}
