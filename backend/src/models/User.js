import bcryptjs from 'bcryptjs';
import { pool } from '../config/database.js';
import crypto from 'crypto';

class User {
    static async create({ username, email, password }) {
        const hashedPassword = await bcryptjs.hash(password, 10);
        const [rows] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id',
            [username, email, hashedPassword]
        );
        return rows[0].id;
    }

    static async createOAuthUser({ username, email, avatarUrl = null, password = null, authProvider = 'google', googleId = null }) {
        const rawPassword = password || crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcryptjs.hash(rawPassword, 10);
        const [rows] = await pool.query(
            `INSERT INTO users (username, email, password_hash, avatar_url, is_verified, auth_provider, google_id)
             VALUES (?, ?, ?, ?, TRUE, ?, ?)
             RETURNING id`,
            [username, email, hashedPassword, avatarUrl, authProvider, googleId]
        );
        return rows[0].id;
    }

    static async findByGoogleId(googleId) {
        const [rows] = await pool.query('SELECT * FROM users WHERE google_id = ? AND deleted_at IS NULL', [googleId]);
        return rows[0];
    }

    static async findByGoogleEmail(email) {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
        return rows[0];
    }

    static async updateById(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...values, id]
        );
    }

    static async findByEmail(email) {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
        return rows[0];
    }

    static async findByUsername(username) {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL', [username]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT id, username, full_name, email, avatar_url, banner_url, bio, is_admin, role, is_verified, created_at FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
        return rows[0];
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE users SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...values, id]
        );
    }

    static async verifyPassword(password, hashedPassword) {
        return bcryptjs.compare(password, hashedPassword);
    }

    static async createPasswordResetToken(userId, token, expiresAt) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE SET
                token_hash = EXCLUDED.token_hash,
                expires_at = EXCLUDED.expires_at,
                used_at = NULL,
                created_at = NOW()`,
            [userId, tokenHash, expiresAt]
        );
    }

    static async findPasswordResetToken(token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await pool.query(
            `SELECT prt.*, u.id AS user_id, u.email, u.username
             FROM password_reset_tokens prt
             JOIN users u ON u.id = prt.user_id
             WHERE prt.token_hash = ? AND prt.used_at IS NULL`,
            [tokenHash]
        );
        return rows[0];
    }

    static async consumePasswordResetToken(token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await pool.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE token_hash = ? AND used_at IS NULL`,
            [tokenHash]
        );
    }

    static async updatePassword(id, password) {
        const hashedPassword = await bcryptjs.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, id]);
    }

    static async findAll(limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT id, username, email, avatar_url, is_admin, created_at FROM users WHERE deleted_at IS NULL LIMIT ? OFFSET ?',
            [limit, offset]
        );
        return rows;
    }

    static async delete(id) {
        await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [id]);
    }

    static async countTotal() {
        const [rows] = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE deleted_at IS NULL');
        return rows[0].count;
    }
}

export default User;
