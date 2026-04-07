import dotenv from 'dotenv';

dotenv.config();

const config = {
    db: {
        // PostgreSQL connection string (dùng cho pool trong database.js)
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
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000, // 500MB
        // uploadDir không còn dùng (Firebase Storage thay thế local disk)
    },
    streaming: {
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 65536, // 64KB
    },
};

export default config;
