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

export async function getIdCardImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { sellerId } = req.params;

    const stream = await adminService.getIdCardImagePath(sellerId as string);
    res.setHeader('Content-Type', 'image/jpeg');
    stream.pipe(res);

  } catch (error) {
    next(error);
  }
}

export async function getSelfieImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { sellerId } = req.params;

    const stream = await adminService.getSelfieImagePath(sellerId as string);

    res.setHeader('Content-Type', 'image/jpeg');
    stream.pipe(res);

  } catch (error) {
    next(error);
  }
}