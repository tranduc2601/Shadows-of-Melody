import { verifyToken } from '../utils/jwt.js';
import Subscription from '../models/Subscription.js';

export const ROLES = Object.freeze(['user', 'artist', 'manager', 'admin']);

const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        req.user = verifyToken(token);
        req._token = token;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access denied. Required role: ${roles.join(' or ')}`,
        });
    }
    next();
};

const authMiddleware = requireAuth;

const adminMiddleware = (req, res, next) => {
    if (!req.user?.is_admin && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

const requirePremium = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { role } = req.user;
    if (role === 'admin' || role === 'manager') {
        return next();
    }
    try {
        const active = await Subscription.isActive(req.user.id);
        if (!active) {
            return res.status(403).json({
                success: false,
                message: 'An active premium subscription is required.',
            });
        }
        next();
    } catch (err) {
        console.error('requirePremium error:', err);
        return res.status(500).json({ success: false, message: 'Could not verify subscription.' });
    }
};

export { requireAuth, requireRole, requirePremium, authMiddleware, adminMiddleware };
