import { type NextFunction, type Request, type Response } from "express";
import * as dealService from "../services/deal.service.js";
import type { UserJWT } from "../module/UserJWT.js";

export async function CreateChatRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const userJWT = (req as any).user as UserJWT;
    const result = await dealService.CreateChatRoom(req.body, userJWT);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function CreateDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dealService.CreateDeal(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function AcceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await dealService.AcceptInvite(req.body.chatRoomMemberId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

import { AppError } from "../utils/errors/AppError.js";

export async function RejectInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const userJWT = (req as any).user as UserJWT;
    const result = await dealService.RejectInvite(req.body.chatRoomMemberId, userJWT.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function UploadPaymentSlip(req: Request, res: Response, next: NextFunction) {
  try {
    const userJWT = (req as any).user as UserJWT;
    const { dealId } = req.body;
    const file = req.file;
    if (!file) {
      throw new AppError("ไม่พบไฟล์หลักฐานการโอนเงิน", 400);
    }
    const result = await dealService.UploadPaymentSlip(dealId, userJWT.userId, userJWT.fullName, file);
    res.json(result);
  } catch (error) {
    next(error);
  }
}