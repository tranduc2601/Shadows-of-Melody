import { pool } from '../config/database.js';

class History {
    static async create(userId, songId, durationPlayed = null) {
        const [result] = await pool.query(
            'INSERT INTO listening_history (user_id, song_id, duration_played) VALUES (?, ?, ?)',
            [userId, songId, durationPlayed]
        );
        return result.insertId;
    }

    static async findByUserId(userId, limit = 50, offset = 0) {
        const [rows] = await pool.query(
            `SELECT lh.*, s.title, s.duration, s.cover_url,
                    GROUP_CONCAT(DISTINCT a.name) as artist_names
             FROM listening_history lh
             JOIN songs s ON lh.song_id = s.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE lh.user_id = ?
             GROUP BY lh.id
             ORDER BY lh.played_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
    }

    static async findBySongId(songId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM listening_history WHERE song_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?',
            [songId, limit, offset]
        );
        return rows;
    }

    static async getRecentSongs(userId, limit = 10) {
        const [rows] = await pool.query(
            `SELECT DISTINCT s.*, 
                    GROUP_CONCAT(DISTINCT a.name) as artist_names,
                    MAX(lh.played_at) as last_played
             FROM listening_history lh
             JOIN songs s ON lh.song_id = s.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE lh.user_id = ?
             GROUP BY s.id
             ORDER BY last_played DESC
             LIMIT ?`,
            [userId, limit]
        );
        return rows;
    }

    static async countByUserId(userId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM listening_history WHERE user_id = ?',
            [userId]
        );
        return rows[0].count;
    }

    static async delete(userId, songId) {
        await pool.query(
            'DELETE FROM listening_history WHERE user_id = ? AND song_id = ?',
            [userId, songId]
        );
    }

    static async deleteOlderThan(days) {
        const [result] = await pool.query(
            'DELETE FROM listening_history WHERE played_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        return result.affectedRows;
    }
}

export default History;
