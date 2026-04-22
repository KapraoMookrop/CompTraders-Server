import { type NextFunction, type Request, type Response } from "express";
import * as userService from "../services/user.service.js";
import type { UserJWT } from "../module/UserJWT.js";
import { AppError } from "../utils/errors/AppError.js";

export async function SignUp(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await userService.SignUp(req.body);
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function Login(req: Request, res: Response, next: NextFunction) {
  try {
    const response = await userService.Login(req.body);

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

export async function CheckAlreadyExistsEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.query;
    const exists = await userService.CheckAlreadyExistsEmail(email as string);
    res.json({ exists });
  } catch (error) {
    next(error);
  }
}

export async function ApplySeller(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, fullName } = (req as any).user as UserJWT;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const requestData = {
      ...req.body,
      IdCardImage: files['IdCardImage']?.[0],
      SelfieImage: files['SelfieImage']?.[0]
    };

    if (!requestData.IdCardImage || !requestData.SelfieImage) {
      throw new AppError('กรุณาอัปโหลดรูปภาพให้ครบถ้วน', 400);
    }

    const application = await userService.ApplySeller(userId, fullName, requestData);
    res.json(application);

  } catch (error) {
    next(error);
  }
}

export async function GetUserClientData(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = (req as any).user as UserJWT;
    const userClientData = await userService.GetUserClientData(userId);
    res.json(userClientData);
  } catch (error) {
    next(error);
  }
}