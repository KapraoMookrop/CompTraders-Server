import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import multer from 'multer';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  }
});

const router = Router();

router.post("/SignUp", userController.SignUp);
router.post("/Login", userController.Login);
router.get("/CheckAlreadyExistsEmail", userController.CheckAlreadyExistsEmail);
router.post("/ApplySeller", authenticateToken, upload.fields([
  { name: 'IdCardImage', maxCount: 1 },
  { name: 'SelfieImage', maxCount: 1 }
]), userController.ApplySeller);
router.get("/GetUserClientData", authenticateToken, userController.GetUserClientData);

export default router;