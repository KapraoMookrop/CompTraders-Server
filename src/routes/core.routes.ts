import { Router } from "express";
import * as coreController from "../controllers/core.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/GetProvinces", coreController.GetProvinces);
router.get("/GetDistricts", coreController.GetDistricts);
router.get("/GetSubDistricts", coreController.GetSubDistricts);
router.get("/VerifyEmail", coreController.VerifyEmail);
router.post("/Enable2FA", authenticateToken, coreController.Enable2FA);
router.post("/Verify2FA", coreController.Verify2FA);

export default router;