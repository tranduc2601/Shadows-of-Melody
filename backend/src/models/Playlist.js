import { pool } from '../config/database.js';

class Playlist {
    static async create(data) {
        const { user_id, name, description, cover_url, is_public } = data;
        const [result] = await pool.query(
            'INSERT INTO playlists (user_id, name, description, cover_url, is_public) VALUES (?, ?, ?, ?, ?)',
            [user_id, name, description, cover_url, is_public]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [id]);
        if (!rows[0]) return null;

        const playlist = rows[0];

        // Get songs in playlist
        const [songs] = await pool.query(
            `SELECT s.*, 
                    GROUP_CONCAT(DISTINCT a.name) as artist_names
             FROM songs s
             JOIN playlist_songs ps ON s.id = ps.song_id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE ps.playlist_id = ?
             GROUP BY s.id
             ORDER BY ps.added_at`,
            [id]
        );
        playlist.songs = songs;

        return playlist;
    }

    static async findByUserId(userId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
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
            `UPDATE playlists SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...values, id]
        );
    }

    static async addSong(playlistId, songId) {
        await pool.query(
            'INSERT IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)',
            [playlistId, songId]
        );
    }

    static async removeSong(playlistId, songId) {
        await pool.query(
            'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
            [playlistId, songId]
        );
    }

    static async delete(id) {
        await pool.query('DELETE FROM playlists WHERE id = ?', [id]);
    }

    static async getSongCount(id) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?',
            [id]
        );
        return rows[0].count;
    }
}

export default Playlist;
