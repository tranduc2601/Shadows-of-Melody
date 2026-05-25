import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,             
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const _pgQuery = pool.query.bind(pool);

pool.query = async (sql, params = []) => {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const result = await _pgQuery(pgSql, params);
    return [result.rows, result.fields ?? []];
};

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

