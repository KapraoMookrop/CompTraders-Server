import { Router } from "express";
import * as coreController from "../controllers/core.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/GetProvinces", coreController.GetProvinces);
router.get("/GetDistricts", coreController.GetDistricts);
router.get("/GetSubDistricts", coreController.GetSubDistricts);

export default router;