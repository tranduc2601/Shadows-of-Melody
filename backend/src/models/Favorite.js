import { pool } from '../config/database.js';

class Favorite {
    static async create(userId, songId) {
        const [result] = await pool.query(
            'INSERT INTO favorites (user_id, song_id) VALUES (?, ?)',
            [userId, songId]
        );
        return result.insertId;
    }

    static async findByUserAndSong(userId, songId) {
        const [rows] = await pool.query(
            'SELECT * FROM favorites WHERE user_id = ? AND song_id = ?',
            [userId, songId]
        );
        return rows[0];
    }

    static async findByUserId(userId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT s.*, 
                    GROUP_CONCAT(DISTINCT a.name) as artist_names,
                    f.created_at as favorited_at
             FROM favorites f
             JOIN songs s ON f.song_id = s.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE f.user_id = ?
             GROUP BY s.id
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
    }

    static async delete(userId, songId) {
        await pool.query(
            'DELETE FROM favorites WHERE user_id = ? AND song_id = ?',
            [userId, songId]
        );
    }

    static async countByUserId(userId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
            [userId]
        );
        return rows[0].count;
    }

    static async countBySongId(songId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM favorites WHERE song_id = ?',
            [songId]
        );
        return rows[0].count;
    }
}

export default Favorite;
