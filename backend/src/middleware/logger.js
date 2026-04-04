// Logger middleware
const logger = (req, res, next) => {
    const start = Date.now();

    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function (data) {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        return originalJson.call(this, data);
    };

    // Override res.send for non-JSON responses
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        return originalSend.call(this, data);
    };

    next();
};

export { logger };
