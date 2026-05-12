import { pool } from '../config/database.js';

class History {
    static async upsert(userId, songId, durationPlayed = null) {
        const [rows] = await pool.query(
            `INSERT INTO listening_history (user_id, song_id, duration_played, played_at)
             VALUES (?, ?, ?, NOW())
             ON CONFLICT (user_id, song_id)
             DO UPDATE SET played_at = NOW(), duration_played = EXCLUDED.duration_played`,
            [userId, songId, durationPlayed]
        );
        return rows;
    }

    static async create(userId, songId, durationPlayed = null) {
        const [rows] = await pool.query(
            `INSERT INTO listening_history (user_id, song_id, duration_played, played_at)
             VALUES (?, ?, ?, NOW())`,
            [userId, songId, durationPlayed]
        );
        return rows;
    }

    static async findByUserId(userId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT
                s.id,
                s.title,
                s.cover_url,
                s.file_url,
                s.duration,
                lh.played_at,
                STRING_AGG(DISTINCT a.name, ', ' ORDER BY a.name) AS artist_names
             FROM listening_history lh
             JOIN songs s ON lh.song_id = s.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE lh.user_id = ?
             GROUP BY s.id, s.title, s.cover_url, s.file_url, s.duration, lh.played_at
             ORDER BY lh.played_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
    }

    static async getRecentSongs(userId, limit = 10) {
        return History.findByUserId(userId, limit, 0);
    }

    static async countByUserId(userId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) AS count FROM listening_history WHERE user_id = ?',
            [userId]
        );
        return rows[0].count;
    }

    static async findBySongId(songId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM listening_history WHERE song_id = ? ORDER BY played_at DESC LIMIT ? OFFSET ?',
            [songId, limit, offset]
        );
        return rows;
    }

    static async delete(userId) {
        await pool.query(
            'DELETE FROM listening_history WHERE user_id = ?',
            [userId]
        );
    }

    static async deleteOlderThan(userId, days) {
        const [rows] = await pool.query(
            `DELETE FROM listening_history
             WHERE user_id = ?
               AND played_at < NOW() - INTERVAL '${parseInt(days, 10)} days'`,
            [userId]
        );
        return rows.length || 0;
    }

    static async hasRecentEntry(userId, songId, withinMinutes = 10) {
        const [rows] = await pool.query(
            `SELECT 1 FROM listening_history
             WHERE user_id = ? AND song_id = ?
               AND played_at > NOW() - (? * INTERVAL '1 minute')
             LIMIT 1`,
            [userId, songId, withinMinutes]
        );
        return rows.length > 0;
    }
}

export default History;
