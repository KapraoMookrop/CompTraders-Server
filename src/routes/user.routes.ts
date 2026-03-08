import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/SignUp", userController.SignUp);
router.post("/Login", userController.Login);
router.post("/GetJwt", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: (req as any).user });
});

export default router;