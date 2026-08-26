import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import * as adminController from '../controllers/admin/seller.controller.js';
import * as adminDealController from '../controllers/admin/deal.controller.js';

const router = express.Router();

router.post('/Seller/FindAsync', authenticateToken, requireAdmin, adminController.FindAsync);
router.get('/Seller/GetSellerByIdAsync', authenticateToken, requireAdmin, adminController.GetSellerByIdAsync);
router.post('/Seller/ApproveSellerAsync', authenticateToken, requireAdmin, adminController.ApproveSellerAsync);
router.post('/Seller/RejectSellerAsync', authenticateToken, requireAdmin, adminController.RejectSellerAsync);

router.post('/Deals/FindAsync', authenticateToken, requireAdmin, adminDealController.FindAsync);
router.get('/Deals/GetDealByIdAsync', authenticateToken, requireAdmin, adminDealController.GetDealByIdAsync);
router.post('/Deals/ConfirmPayment', authenticateToken, requireAdmin, adminDealController.ConfirmPayment);

export default router;