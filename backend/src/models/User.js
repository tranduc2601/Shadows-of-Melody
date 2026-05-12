import bcryptjs from 'bcryptjs';
import { pool } from '../config/database.js';

class User {
    static async create({ username, email, password }) {
        const hashedPassword = await bcryptjs.hash(password, 10);
        const [rows] = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id',
            [username, email, hashedPassword]
        );
        return rows[0].id;
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
