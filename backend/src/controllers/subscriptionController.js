import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';

export const getSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const subscription = await Subscription.findByUserId(userId);

        return res.status(200).json({
            success: true,
            data: subscription || { subscription_type: 'free' },
        });
    } catch (error) {
        console.error('GetSubscription error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription',
        });
    }
};

export const upgradeSubscription = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscriptionType } = req.body;

        if (!['free', 'premium', 'vip'].includes(subscriptionType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription type',
            });
        }

        let existingSubscription = await Subscription.findByUserId(userId);

        if (!existingSubscription) {
            // Create new subscription
            const subscriptionId = await Subscription.create(userId, subscriptionType, new Date(), null);
            existingSubscription = await Subscription.findById(subscriptionId);
        } else {
            // Update subscription
            await Subscription.update(existingSubscription.id, {
                subscription_type: subscriptionType,
                start_date: new Date(),
            });
            existingSubscription = await Subscription.findById(existingSubscription.id);
        }

        return res.status(200).json({
            success: true,
            message: 'Subscription upgraded successfully',
            data: existingSubscription,
        });
    } catch (error) {
        console.error('UpgradeSubscription error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upgrade subscription',
        });
    }
};

export const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const payments = await Payment.findByUserId(userId, limit, offset);

        return res.status(200).json({
            success: true,
            data: payments,
            pagination: {
                page,
                limit,
            },
        });
    } catch (error) {
        console.error('GetPaymentHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
        });
    }
};

export const createPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subscriptionType, amount, paymentMethod, transactionId } = req.body;

        if (!amount || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Amount and payment method required',
            });
        }

        // Create subscription first
        let subscription = await Subscription.findByUserId(userId);
        if (!subscription) {
            const subscriptionId = await Subscription.create(userId, subscriptionType || 'premium', new Date(), null);
            subscription = await Subscription.findById(subscriptionId);
        } else {
            // Update subscription type
            await Subscription.update(subscription.id, {
                subscription_type: subscriptionType || subscription.subscription_type,
            });
            subscription = await Subscription.findById(subscription.id);
        }

        // Create payment record
        const paymentId = await Payment.create({
            user_id: userId,
            subscription_id: subscription.id,
            amount,
            currency: 'USD',
            payment_method: paymentMethod,
            transaction_id: transactionId,
            status: 'completed',
        });

        const payment = await Payment.findById(paymentId);

        return res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: payment,
        });
    } catch (error) {
        console.error('CreatePayment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create payment',
        });
    }
};

export const getSubscriptionStats = async (req, res) => {
    try {
        const totalActive = await Subscription.countActive();
        const premiumUsers = await Subscription.countByType('premium');
        const vipUsers = await Subscription.countByType('vip');
        const totalRevenue = await Payment.getTotalRevenue();

        return res.status(200).json({
            success: true,
            data: {
                totalActive,
                premiumUsers,
                vipUsers,
                freeUsers: totalActive - premiumUsers - vipUsers,
                totalRevenue,
            },
        });
    } catch (error) {
        console.error('GetSubscriptionStats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription stats',
        });
    }
};
