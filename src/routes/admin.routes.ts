import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import * as adminController from '../controllers/admin/seller.controller.js';

const router = express.Router();

router.post('/Seller/FindAsync', authenticateToken, requireAdmin, adminController.FindAsync);
router.get('/Seller/GetIdCard/:sellerId', authenticateToken, requireAdmin, adminController.getIdCardImage);
router.get('/Seller/GetSelfie/:sellerId', authenticateToken, requireAdmin, adminController.getSelfieImage);

export default router;