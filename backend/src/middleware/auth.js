import { verifyToken } from '../utils/jwt.js';

// ── Role hierarchy ────────────────────────────────────────────────────────────
// Used to derive implicit permissions. A higher-ranked role includes all
// permissions of lower ranks wherever the code explicitly checks with
// requireRole(). Do NOT rely on this for fine-grained checks — always use
// requireRole with the exact allowed roles list.
export const ROLES = Object.freeze(['user', 'artist', 'manager', 'admin']);

// ── requireAuth ───────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer JWT, checks the blocklist, and attaches `req.user`.
 * Returns 401 when the token is missing, invalid, or revoked.
 */
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        req.user = verifyToken(token);
        req._token = token; // keep raw token available for revocation
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// ── requireRole ───────────────────────────────────────────────────────────────
/**
 * Factory that returns middleware accepting any of the specified roles.
 * Must be used AFTER requireAuth.
 *
 * @param {...string} roles  Allowed role names, e.g. requireRole('admin', 'manager')
 */
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

// ── Legacy aliases (kept for backward compatibility) ─────────────────────────
const authMiddleware = requireAuth;

const adminMiddleware = (req, res, next) => {
    if (!req.user?.is_admin && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

export { requireAuth, requireRole, authMiddleware, adminMiddleware };
