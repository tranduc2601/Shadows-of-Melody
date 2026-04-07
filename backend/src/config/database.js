import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // vd: postgresql://user:pass@host:5432/dbname
    // Hoặc tách riêng từng trường nếu không dùng connection string:
    // host:     process.env.DB_HOST     || 'localhost',
    // port:     parseInt(process.env.DB_PORT) || 5432,
    // user:     process.env.DB_USER     || 'postgres',
    // password: process.env.DB_PASSWORD || '',
    // database: process.env.DB_NAME     || 'shadows_of_melody',
    max: 10,               // kích thước pool tối đa
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ─── Compatibility wrapper ────────────────────────────────────────────────────
// pg trả về { rows } còn mysql2 trả về [rows, fields].
// Wrapper này tự động:
//   1. Chuyển placeholder ? → $1, $2, ... (cú pháp PostgreSQL)
//   2. Trả về [rows, fields] để các model hiện tại không cần sửa
const _pgQuery = pool.query.bind(pool);

pool.query = async (sql, params = []) => {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await _pgQuery(pgSql, params);
    // Trả về [rows, fields] giống mysql2
    return [result.rows, result.fields ?? []];
};

// ─── Test connection ──────────────────────────────────────────────────────────
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('PostgreSQL Database connected successfully');
        client.release();
    } catch (error) {
        console.error('PostgreSQL Connection Error:', error.message);
        process.exit(1);
    }
};

export { pool, testConnection };

