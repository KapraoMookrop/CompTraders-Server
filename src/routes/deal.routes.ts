import { Router } from "express";
import * as dealController from "../controllers/deal.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/GetMessages", authenticateToken, dealController.GetMessages);
router.post("/CreateChatRoom", authenticateToken, dealController.CreateChatRoom);
router.post("/SendMessages", authenticateToken, dealController.SendMessages);
router.post("/MarkAsRead", authenticateToken, dealController.MarkAsRead);
router.post("/GetAllUnread", authenticateToken, dealController.GetAllUnread);
router.post("/CreateDeal", authenticateToken, dealController.CreateDeal);

export default router;