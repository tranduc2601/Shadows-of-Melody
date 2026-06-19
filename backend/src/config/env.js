import dotenv from 'dotenv';

dotenv.config();

const config = {
    db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/shadows_of_melody',
        ssl: process.env.DB_SSL === 'true',
    },
    cloudinary: {
        cloudName:  process.env.CLOUDINARY_CLOUD_NAME,
        apiKey:     process.env.CLOUDINARY_API_KEY,
        apiSecret:  process.env.CLOUDINARY_API_SECRET,
    },
    server: {
        port: process.env.PORT || 5000,
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production',
        expiresIn: process.env.JWT_EXPIRE || '7d',
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
    },
    vnpay: {
        tmnCode: process.env.VNPAY_TMN_CODE || '',
        hashSecret: process.env.VNPAY_HASH_SECRET || '',
        paymentUrl: process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5000/api/payments/vnpay/return',
        ipnUrl: process.env.VNPAY_IPN_URL || 'http://localhost:5000/api/payments/vnpay/ipn',
        locale: process.env.VNPAY_LOCALE || 'vn',
        orderType: process.env.VNPAY_ORDER_TYPE || 'other',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:4321',
    },
    mail: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'Shadows of Melody <no-reply@shadows-of-melody.local>',
    },
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000,
    },
    streaming: {
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 65536,
    },
};

export default config;
