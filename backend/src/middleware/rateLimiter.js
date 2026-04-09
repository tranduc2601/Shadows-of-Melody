import rateLimit from 'express-rate-limit';

// General rate limiter: 300 requests per 15 minutes (increased from 100 to prevent 429 on normal usage)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth rate limiter: 5 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
});

// Upload rate limiter: 10 uploads per hour
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many uploads, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Search rate limiter: 30 searches per minute
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many search requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Role request rate limiter: max 3 requests per hour — prevents spamming artist requests
const roleRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many role requests submitted, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

export { generalLimiter, authLimiter, uploadLimiter, searchLimiter, roleRequestLimiter };
