import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import { pool } from '../config/database.js';

const EXEMPT_ROLES = ['admin', 'manager'];
const PLAN_CONFIG = {
    free:    { label: 'Free',    price: 0,     durationDays: 0,   features: ['Nghe nhạc miễn phí', 'Quảng cáo', 'Danh sách phát cơ bản'] },
    premium: { label: 'Premium', price: 59000, durationDays: 30,  features: ['Không quảng cáo', 'Nghe ngoại tuyến', 'Âm thanh chất lượng cao'] },
    vip:     { label: 'VIP',     price: 99000, durationDays: 30,  features: ['Mọi tính năng Premium', 'Ưu tiên hỗ trợ', 'Nội dung độc quyền'] },
};

function calcEndDate(startDate, durationDays) {
    if (!durationDays) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d;
}

export const listPlans = async (_req, res) => {
    return res.json({ success: true, data: PLAN_CONFIG });
};

export const getSubscription = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        if (EXEMPT_ROLES.includes(role)) {
            return res.status(200).json({ success: true, data: { subscription_type: role === 'admin' ? 'admin' : 'manager', is_active: true, exempt: true, status: 'active' } });
        }
        const subscription = await Subscription.findByUserId(userId);
        const plan = PLAN_CONFIG[subscription?.subscription_type || 'free'] || PLAN_CONFIG.free;
        const isActive = !!subscription && (subscription.is_active ?? true) && (!subscription.end_date || new Date(subscription.end_date) > new Date());
        return res.status(200).json({ success: true, data: { ...subscription, plan, is_active: isActive, status: isActive ? 'active' : 'expired' } });
    } catch (error) { console.error('GetSubscription error:', error); return res.status(500).json({ success: false, message: 'Failed to fetch subscription' }); }
};

function buildMomoPaymentUrl({ transactionId, amount, plan, userId }) {
    const params = new URLSearchParams({
        partnerCode: 'MOMO_DEMO',
        accessKey: 'MOMO_ACCESS_KEY',
        requestId: transactionId,
        orderId: transactionId,
        orderInfo: `Subscribe ${plan} plan for user ${userId}`,
        amount: String(amount),
        extraData: Buffer.from(JSON.stringify({ plan, userId })).toString('base64'),
    });
    return `https://test-payment.momo.vn/v2/gateway/api/create?${params.toString()}`;
}

export const startCheckout = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        if (EXEMPT_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'System administrators do not require subscriptions.' });
        const { plan = 'premium', paymentMethod = 'momo' } = req.body;
        const cfg = PLAN_CONFIG[plan];
        if (!cfg || plan === 'free') return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        const transactionId = `sub_${userId}_${Date.now()}`;
        const paymentUrl = paymentMethod === 'momo' ? buildMomoPaymentUrl({ transactionId, amount: cfg.price, plan, userId }) : null;
        const [existing] = await pool.query('SELECT id FROM subscriptions WHERE user_id = ? LIMIT 1', [userId]);
        const current = existing[0];
        const startDate = new Date();
        const endDate = calcEndDate(startDate, cfg.durationDays);
        let subscriptionId = current?.id;
        if (!subscriptionId) {
            subscriptionId = await Subscription.create(userId, plan, startDate, endDate);
        } else {
            await Subscription.update(subscriptionId, { subscription_type: plan, start_date: startDate, end_date: endDate, is_active: true });
        }
        const paymentId = await Payment.create({ user_id: userId, subscription_id: subscriptionId, amount: cfg.price, currency: 'VND', payment_method: paymentMethod, transaction_id: transactionId, status: 'pending', description: `Subscription ${cfg.label}` });
        const payment = await Payment.findById(paymentId);
        const subscription = await Subscription.findById(subscriptionId);
        return res.status(201).json({ success: true, message: 'Checkout created', data: { subscription, payment, payment_url: paymentUrl, transaction_id: transactionId } });
    } catch (error) { console.error('StartCheckout error:', error); return res.status(500).json({ success: false, message: 'Failed to start checkout' }); }
};

export const confirmMomoPayment = async (req, res) => {
    try {
        const { transactionId, status = 'completed' } = req.body || {};
        if (!transactionId) return res.status(400).json({ success: false, message: 'Transaction id required' });
        const payment = await Payment.findByTransactionId(transactionId);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
        await Payment.update(payment.id, { status });
        if (status === 'completed') {
            await Subscription.update(payment.subscription_id, { is_active: true });
        }
        return res.json({ success: true, data: { payment: await Payment.findById(payment.id), subscription: await Subscription.findById(payment.subscription_id) } });
    } catch (error) { console.error('ConfirmMomoPayment error:', error); return res.status(500).json({ success: false, message: 'Failed to confirm payment' }); }
};

export const cancelSubscription = async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        if (EXEMPT_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'System administrators do not require subscriptions.' });
        const subscription = await Subscription.findByUserId(userId);
        if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found' });
        await Subscription.update(subscription.id, { is_active: false });
        return res.json({ success: true, message: 'Subscription cancelled successfully', data: await Subscription.findById(subscription.id) });
    } catch (error) { console.error('CancelSubscription error:', error); return res.status(500).json({ success: false, message: 'Failed to cancel subscription' }); }
};

export const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const payments = await Payment.findByUserId(userId, limit, offset);
        return res.status(200).json({ success: true, data: payments, pagination: { page, limit } });
    } catch (error) { console.error('GetPaymentHistory error:', error); return res.status(500).json({ success: false, message: 'Failed to fetch payment history' }); }
};

export const getSubscriptionStats = async (_req, res) => {
    try {
        const [subs] = await pool.query(`SELECT subscription_type, COUNT(*)::int AS count FROM subscriptions GROUP BY subscription_type`);
        const [payments] = await pool.query(`SELECT COALESCE(SUM(amount),0)::numeric AS total_revenue, COUNT(*)::int AS payments_count FROM payments WHERE status = 'completed'`);
        return res.json({ success: true, data: { breakdown: subs, totalRevenue: payments[0]?.total_revenue || 0, paymentsCount: payments[0]?.payments_count || 0, plans: PLAN_CONFIG } });
    } catch (error) { console.error('GetSubscriptionStats error:', error); return res.status(500).json({ success: false, message: 'Failed to fetch subscription stats' }); }
};
