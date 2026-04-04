// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('[ERROR]', err);

    // Security: don't expose stack trace in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: isDevelopment ? err.details : undefined,
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
        });
    }

    // MySQL errors
    if (err.code && err.code.startsWith('ER_')) {
        return res.status(400).json({
            success: false,
            message: 'Database error',
            error: isDevelopment ? err.message : 'An error occurred',
        });
    }

    // Default error response
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(isDevelopment && { stack: err.stack }),
    });
};

export { errorHandler };
