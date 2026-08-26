import { Router } from "express";
import * as dealController from "../controllers/deal.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  }
});

const router = Router();

router.post("/CreateChatRoom", authenticateToken, dealController.CreateChatRoom);
router.post("/CreateDeal", authenticateToken, dealController.CreateDeal);
router.post("/AcceptInvite", authenticateToken, dealController.AcceptInvite);
router.post("/RejectInvite", authenticateToken, dealController.RejectInvite);
router.post("/UploadPaymentSlip", authenticateToken, upload.single('SlipImage'), dealController.UploadPaymentSlip);
router.post("/ShipDeal", authenticateToken, upload.single('PackageImage'), dealController.ShipDeal);

export default router;