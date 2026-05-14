import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', subscriptionController.listPlans);
router.get('/', requireAuth, subscriptionController.getSubscription);
router.post('/checkout', requireAuth, subscriptionController.startCheckout);
router.post('/momo/confirm', subscriptionController.confirmMomoPayment);
router.post('/cancel', requireAuth, subscriptionController.cancelSubscription);
router.get('/payments', requireAuth, subscriptionController.getPaymentHistory);
router.get('/admin/stats', requireAuth, requireRole('manager', 'admin'), subscriptionController.getSubscriptionStats);

export default router;
