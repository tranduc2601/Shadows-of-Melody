import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// User subscription routes
router.get('/', requireAuth, subscriptionController.getSubscription);
router.post('/upgrade', requireAuth, subscriptionController.upgradeSubscription);

// Payment routes
router.get('/payments', requireAuth, subscriptionController.getPaymentHistory);
router.post('/payments', requireAuth, subscriptionController.createPayment);

// Admin stats
router.get('/admin/stats', requireAuth, requireRole('manager', 'admin'), subscriptionController.getSubscriptionStats);

export default router;
