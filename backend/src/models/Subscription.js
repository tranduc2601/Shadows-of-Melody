import { pool } from '../config/database.js';

class Subscription {
    static async create(userId, subscriptionType, startDate, endDate) {
        const [rows] = await pool.query(
            'INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date) VALUES (?, ?, ?, ?) RETURNING id',
            [userId, subscriptionType, startDate, endDate]
        );
        return rows[0].id;
    }

    static async findByUserId(userId) {
        const [rows] = await pool.query(
            'SELECT * FROM subscriptions WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM subscriptions WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE subscriptions SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...values, id]
        );
    }

    static async isActive(userId) {
        const [rows] = await pool.query(
            'SELECT * FROM subscriptions WHERE user_id = ? AND is_active = TRUE AND (end_date IS NULL OR end_date > NOW())',
            [userId]
        );
        return rows.length > 0;
    }

    static async getType(userId) {
        const [rows] = await pool.query(
            'SELECT subscription_type FROM subscriptions WHERE user_id = ? AND is_active = TRUE LIMIT 1',
            [userId]
        );
        return rows[0]?.subscription_type || 'free';
    }

    static async delete(id) {
        await pool.query('DELETE FROM subscriptions WHERE id = ?', [id]);
    }

    static async countActive() {
        const [rows] = await pool.query(
            'SELECT COUNT(*)::int as count FROM subscriptions WHERE is_active = TRUE'
        );
        return rows[0].count;
    }

    static async countByType(subscriptionType) {
        const [rows] = await pool.query(
            'SELECT COUNT(*)::int as count FROM subscriptions WHERE subscription_type = ? AND is_active = TRUE',
            [subscriptionType]
        );
        return rows[0].count;
    }
}

export default Subscription;
