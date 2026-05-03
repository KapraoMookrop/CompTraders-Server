import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import * as adminController from '../controllers/admin/seller.controller.js';

const router = express.Router();

router.post('/Seller/FindAsync', authenticateToken, requireAdmin, adminController.FindAsync);
router.get('/Seller/GetSellerByIdAsync', authenticateToken, requireAdmin, adminController.GetSellerByIdAsync);
router.post('/Seller/ApproveSellerAsync', authenticateToken, requireAdmin, adminController.ApproveSellerAsync);
router.post('/Seller/RejectSellerAsync', authenticateToken, requireAdmin, adminController.RejectSellerAsync);

export default router;