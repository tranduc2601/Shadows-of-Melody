import dotenv from 'dotenv';

dotenv.config();

const config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'shadows_of_melody',
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
        uploadDir: process.env.UPLOAD_DIR || 'uploads',
    },
    streaming: {
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 65536, // 64KB
    },
};

export default config;
