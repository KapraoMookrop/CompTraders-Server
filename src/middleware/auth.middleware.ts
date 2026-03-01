import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Access Token Required" });
    return;
  }

  jwt.verify(token, ENV.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ message: "Invalid or Expired Token" });
      return;
    }
    
    (req as any).user = user;
    next();
  });
};