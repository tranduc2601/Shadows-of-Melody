import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

// User subscription routes
router.get('/', authMiddleware, subscriptionController.getSubscription);
router.post('/upgrade', authMiddleware, subscriptionController.upgradeSubscription);

// Payment routes
router.get('/payments', authMiddleware, subscriptionController.getPaymentHistory);
router.post('/payments', authMiddleware, subscriptionController.createPayment);

// Admin stats
router.get('/admin/stats', authMiddleware, adminMiddleware, subscriptionController.getSubscriptionStats);

export default router;
