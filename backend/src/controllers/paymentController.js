import crypto from 'crypto';
import config from '../config/env.js';
import { pool } from '../config/database.js';
import { appendSecureHash, formatVnpayDate, toVnpayQueryString, verifySecureHash } from '../utils/vnpay.js';
import { PLAN_CONFIG, calcEndDate, planFromPaymentDescription } from '../utils/subscriptionPlans.js';

function normalizeQuery(query = {}) {
    return Object.keys(query).reduce((params, key) => {
        const value = query[key];
        params[key] = Array.isArray(value) ? value[0] : value;
        return params;
    }, {});
}

function createTxnRef() {
    return `SOM${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const rawIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.ip || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim();

    if (!rawIp || rawIp === '::1') return '127.0.0.1';
    return rawIp.replace(/^::ffff:/, '');
}

function requireVnpayConfig() {
    const missing = [];
    if (!config.vnpay.tmnCode) missing.push('VNPAY_TMN_CODE');
    if (!config.vnpay.hashSecret) missing.push('VNPAY_HASH_SECRET');
    if (!config.vnpay.paymentUrl) missing.push('VNPAY_PAYMENT_URL');
    if (!config.vnpay.returnUrl) missing.push('VNPAY_RETURN_URL');

    if (missing.length) {
        const err = new Error(`Missing VNPay config: ${missing.join(', ')}`);
        err.statusCode = 500;
        throw err;
    }
}

function frontendRedirectUrl(status, params = {}) {
    const fallbackOrigin = 'http://localhost:4321';
    const origin = config.cors.origin && config.cors.origin !== '*' ? config.cors.origin.split(',')[0].trim() : fallbackOrigin;
    const url = new URL('/subscription', origin || fallbackOrigin);
    url.searchParams.set('payment', status);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });

    return url.toString();
}

function vnpayIpn(res, rspCode, message) {
    return res.status(200).json({ RspCode: rspCode, Message: message });
}

function isSuccessfulVnpayTransaction(params) {
    return params.vnp_ResponseCode === '00' && (!params.vnp_TransactionStatus || params.vnp_TransactionStatus === '00');
}

class VnpayCompletionError extends Error {
    constructor(rspCode, message) {
        super(message);
        this.rspCode = rspCode;
    }
}

async function completePaymentFromVnpay(params) {
    const txnRef = params.vnp_TxnRef;
    const receivedAmount = Number(params.vnp_Amount);
    const responseCode = params.vnp_ResponseCode || null;
    const transactionNo = params.vnp_TransactionNo || null;
    const now = new Date();

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE order_id = $1 FOR UPDATE',
            [txnRef]
        );

        const payment = paymentResult.rows[0];
        if (!payment) {
            throw new VnpayCompletionError('01', 'Order not found');
        }

        if (payment.status === 'completed') {
            await client.query('COMMIT');
            return { status: 'completed', alreadyCompleted: true, payment };
        }

        const expectedAmount = Math.round(Number(payment.amount) * 100);
        if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount) {
            throw new VnpayCompletionError('04', 'Invalid amount');
        }

        if (payment.status !== 'pending') {
            throw new VnpayCompletionError('02', 'Order already confirmed');
        }

        if (!isSuccessfulVnpayTransaction(params)) {
            await client.query(
                `UPDATE payments
                 SET status = 'failed',
                     transaction_id = COALESCE($1, transaction_id),
                     response_code = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [transactionNo, responseCode, payment.id]
            );

            await client.query('COMMIT');
            return { status: 'failed', alreadyCompleted: false, payment };
        }

        const plan = planFromPaymentDescription(payment.description);
        const cfg = PLAN_CONFIG[plan];
        if (!cfg || plan === 'free') {
            throw new VnpayCompletionError('99', `Unable to resolve subscription plan for payment ${payment.id}`);
        }

        const subscriptionResult = await client.query(
            'SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE',
            [payment.subscription_id]
        );
        const subscription = subscriptionResult.rows[0];

        if (!subscription) {
            throw new VnpayCompletionError('99', `Subscription not found for payment ${payment.id}`);
        }

        const existingEndDate = subscription.end_date ? new Date(subscription.end_date) : null;
        const baseDate = subscription.is_active && existingEndDate && existingEndDate > now ? existingEndDate : now;
        const endDate = calcEndDate(baseDate, cfg.durationDays);

        await client.query(
            `UPDATE payments
             SET status = 'completed',
                 transaction_id = $1,
                 response_code = $2,
                 paid_at = $3,
                 updated_at = NOW()
             WHERE id = $4`,
            [transactionNo, responseCode, now, payment.id]
        );

        await client.query(
            `UPDATE subscriptions
             SET subscription_type = $1,
                 start_date = $2,
                 end_date = $3,
                 is_active = TRUE,
                 payment_provider = 'vnpay',
                 plan_label = $4,
                 amount_paid = $5,
                 currency = 'VND',
                 updated_at = NOW()
             WHERE id = $6`,
            [plan, now, endDate, cfg.label, cfg.price, subscription.id]
        );

        await client.query('COMMIT');
        return { status: 'completed', alreadyCompleted: false, payment };
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch {}
        }
        throw error;
    } finally {
        if (client) client.release();
    }
}

export const createVnpayPayment = async (req, res) => {
    let client;

    try {
        requireVnpayConfig();

        const { id: userId } = req.user;
        const plan = String(req.body?.plan || 'premium').toLowerCase();
        const cfg = PLAN_CONFIG[plan];

        if (!cfg || plan === 'free') {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        const txnRef = createTxnRef();
        const now = new Date();
        const expireDate = new Date(now.getTime() + 15 * 60 * 1000);

        client = await pool.connect();
        await client.query('BEGIN');

        const subscriptionResult = await client.query(
            'SELECT id FROM subscriptions WHERE user_id = $1 FOR UPDATE',
            [userId]
        );

        let subscriptionId = subscriptionResult.rows[0]?.id;
        if (!subscriptionId) {
            const createdSubscription = await client.query(
                `INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date, is_active)
                 VALUES ($1, 'free', $2, NULL, TRUE)
                 RETURNING id`,
                [userId, now]
            );
            subscriptionId = createdSubscription.rows[0].id;
        }

        await client.query(
            `UPDATE payments
             SET status = 'failed',
                 response_code = COALESCE(response_code, 'superseded'),
                 updated_at = NOW()
             WHERE user_id = $1
               AND payment_provider = 'vnpay'
               AND status = 'pending'`,
            [userId]
        );

        const paymentResult = await client.query(
            `INSERT INTO payments (
                user_id, subscription_id, amount, currency, payment_method, payment_provider,
                transaction_id, order_id, response_code, status, description, paid_at
             )
             VALUES ($1, $2, $3, 'VND', 'vnpay', 'vnpay', NULL, $4, NULL, 'pending', $5, NULL)
             RETURNING *`,
            [userId, subscriptionId, cfg.price, txnRef, `Subscription ${cfg.label}`]
        );

        await client.query('COMMIT');

        const vnpayParams = appendSecureHash({
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: config.vnpay.tmnCode,
            vnp_Amount: cfg.price * 100,
            vnp_CurrCode: 'VND',
            vnp_TxnRef: txnRef,
            vnp_OrderInfo: `Shadows of Melody ${cfg.label} subscription ${txnRef}`,
            vnp_OrderType: config.vnpay.orderType,
            vnp_Locale: config.vnpay.locale,
            vnp_ReturnUrl: config.vnpay.returnUrl,
            vnp_IpAddr: getClientIp(req),
            vnp_CreateDate: formatVnpayDate(now),
            vnp_ExpireDate: formatVnpayDate(expireDate),
        }, config.vnpay.hashSecret);

        const paymentUrl = `${config.vnpay.paymentUrl}?${toVnpayQueryString(vnpayParams)}`;

        return res.status(201).json({
            success: true,
            message: 'VNPay checkout created',
            data: {
                paymentUrl,
                payment_url: paymentUrl,
                orderId: txnRef,
                order_id: txnRef,
                payment: paymentResult.rows[0],
            },
        });
    } catch (error) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch {}
        }
        console.error('CreateVnpayPayment error:', error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to create VNPay payment' });
    } finally {
        if (client) client.release();
    }
};

export const handleVnpayReturn = async (req, res) => {
    try {
        const params = normalizeQuery(req.query);
        const validSignature = verifySecureHash(params, config.vnpay.hashSecret);

        if (!validSignature) {
            return res.redirect(frontendRedirectUrl('invalid', {
                gateway: 'vnpay',
                orderId: params.vnp_TxnRef,
            }));
        }

        const result = await completePaymentFromVnpay(params);
        const paymentStatus = result.status === 'completed' ? 'success' : 'failed';

        return res.redirect(frontendRedirectUrl(paymentStatus, {
            gateway: 'vnpay',
            orderId: params.vnp_TxnRef,
            responseCode: params.vnp_ResponseCode,
        }));
    } catch (error) {
        if (error instanceof VnpayCompletionError) {
            return res.redirect(frontendRedirectUrl('failed', {
                gateway: 'vnpay',
                orderId: req.query?.vnp_TxnRef,
                responseCode: req.query?.vnp_ResponseCode,
            }));
        }
        console.error('HandleVnpayReturn error:', error);
        return res.redirect(frontendRedirectUrl('error', { gateway: 'vnpay' }));
    }
};

export const handleVnpayIpn = async (req, res) => {
    const params = normalizeQuery(req.query);

    if (!verifySecureHash(params, config.vnpay.hashSecret)) {
        return vnpayIpn(res, '97', 'Invalid Checksum');
    }

    try {
        await completePaymentFromVnpay(params);
        return vnpayIpn(res, '00', 'Confirm success');
    } catch (error) {
        if (error instanceof VnpayCompletionError) {
            return vnpayIpn(res, error.rspCode, error.message);
        }
        console.error('HandleVnpayIpn error:', error);
        return vnpayIpn(res, '99', 'Unknown error');
    }
};
