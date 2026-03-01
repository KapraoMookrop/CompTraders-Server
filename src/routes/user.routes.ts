import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/sign", userController.SignUp);
router.post("/login", userController.Login);
router.post("/getJwt", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: (req as any).user });
});

export default router;