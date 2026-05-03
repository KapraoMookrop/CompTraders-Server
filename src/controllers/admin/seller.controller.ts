import { type NextFunction, type Request, type Response } from "express";
import * as adminService from "../../services/admin/seller.service.js";

export async function FindAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.FindAsync(req.body);
    res.json(data);

  } catch (error) {
    next(error);
  }
}

export async function GetSellerByIdAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = req.query.sellerId as string;
    const data = await adminService.GetSellerByIdAsync(sellerId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function ApproveSellerAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = req.body.sellerId as string;
    const reviewedBy = (req as any).user?.userId;
    await adminService.ApproveSellerAsync(sellerId, reviewedBy);
    res.json({ message: "ยืนยันผู้ขายเรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}

export async function RejectSellerAsync(req: Request, res: Response, next: NextFunction) {
  try {
    const { sellerId, comment } = req.body;
    const reviewedBy = (req as any).user?.userId;
    await adminService.RejectSellerAsync(sellerId, comment, reviewedBy);
    res.json({ message: "ปฏิเสธผู้ขายเรียบร้อยแล้ว" });
  } catch (error) {
    next(error);
  }
}