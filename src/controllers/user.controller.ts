import { type NextFunction, type Request, type Response } from "express";
import * as userService from "../services/user.service.js";

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
    const response = await userService.Login(req.body.email, req.body.password);

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