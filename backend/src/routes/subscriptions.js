import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();


router.get('/', requireAuth, subscriptionController.getSubscription);
router.post('/upgrade', requireAuth, subscriptionController.upgradeSubscription);


router.get('/payments', requireAuth, subscriptionController.getPaymentHistory);
router.post('/payments', requireAuth, subscriptionController.createPayment);


router.get('/admin/stats', requireAuth, requireRole('manager', 'admin'), subscriptionController.getSubscriptionStats);

export default router;
