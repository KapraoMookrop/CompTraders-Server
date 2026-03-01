import { type Request, type Response } from "express";
import * as userService from "../services/user.service.js";

export async function SignUp(req: Request, res: Response) {
  const users = await userService.SignUp(req.body);
  res.json(users);
}

export async function Login(req: Request, res: Response) {
  const loginResponseData = await userService.Login(req.body.Email, req.body.Password);
  res.json(loginResponseData);
}