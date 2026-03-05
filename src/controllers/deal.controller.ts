import { type NextFunction, type Request, type Response } from "express";
import * as dealService from "../services/deal.service.js";

export async function GetMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.getMessages(req.body.chatRoomId, (req as any).user.userId, req.body.cursor);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
export async function CreateChatRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.CreateChatRoom(req.body);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
export async function SendMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.SendMessages(req.body);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
export async function MarkAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.markAsRead(req.body);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
export async function GetAllUnread(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.getAllUnread(req.body.userId);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
export async function CreateDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await dealService.CreateDeal(req.body);
    res.json(users);
  } catch (error) {
    next(error);
  }
}