import { pool } from '../config/database.js';

class Payment {
    static async create(data) {
        const { user_id, subscription_id, amount, currency, payment_method, transaction_id, status, description } = data;
        const [result] = await pool.query(
            'INSERT INTO payments (user_id, subscription_id, amount, currency, payment_method, transaction_id, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, subscription_id, amount, currency, payment_method, transaction_id, status, description]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM payments WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async findByTransactionId(transactionId) {
        const [rows] = await pool.query(
            'SELECT * FROM payments WHERE transaction_id = ?',
            [transactionId]
        );
        return rows[0];
    }

    static async findByUserId(userId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC LIMIT ? OFFSET ?',
            [userId, limit, offset]
        );
        return rows;
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE payments SET ${fields} WHERE id = ?`,
            [...values, id]
        );
    }

    static async countByStatus(status) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM payments WHERE status = ?',
            [status]
        );
        return rows[0].count;
    }

    static async getTotalRevenue(startDate = null, endDate = null) {
        let query = "SELECT SUM(amount) as total FROM payments WHERE status = 'completed'";
        const params = [];

        if (startDate) {
            query += ' AND payment_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND payment_date <= ?';
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total || 0;
    }
}

export default Payment;
