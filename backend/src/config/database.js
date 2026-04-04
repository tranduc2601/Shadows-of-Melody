import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shadows_of_melody',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
});

// Test connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('MySQL Connection Error:', error.message);
        process.exit(1);
    }
};

export { pool, testConnection };
