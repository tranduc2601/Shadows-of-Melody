import { verifyToken } from '../utils/jwt.js';

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user?.is_admin) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }
    next();
};

export { authMiddleware, adminMiddleware };
