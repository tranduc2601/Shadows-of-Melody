import { pool } from '../config/database.js';

class Playlist {
    static async create(data) {
        const { user_id, name, description, cover_url, is_public } = data;
        const [rows] = await pool.query(
            'INSERT INTO playlists (user_id, name, description, cover_url, is_public) VALUES (?, ?, ?, ?, ?) RETURNING id',
            [user_id, name, description, cover_url, is_public]
        );
        return rows[0].id;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [id]);
        if (!rows[0]) return null;

        const playlist = rows[0];

        const [songs] = await pool.query(
            `SELECT s.*, 
                    STRING_AGG(DISTINCT a.name, ',') as artist_names
             FROM songs s
             JOIN playlist_songs ps ON s.id = ps.song_id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE ps.playlist_id = ?
             GROUP BY s.id, ps.added_at
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
            'INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?) ON CONFLICT (playlist_id, song_id) DO NOTHING',
            [playlistId, songId]
        );
    }

    static async isSongInPlaylist(playlistId, songId) {
        const [rows] = await pool.query(
            'SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ? LIMIT 1',
            [playlistId, songId]
        );
        return rows.length > 0;
    }

    static async findByUserIdWithMeta(userId, limit = 50, offset = 0) {
        const [rows] = await pool.query(
            `SELECT p.*,
                    COUNT(DISTINCT ps.song_id) AS songs_count,
                    (SELECT s2.cover_url FROM playlist_songs ps2
                     JOIN songs s2 ON s2.id = ps2.song_id
                     WHERE ps2.playlist_id = p.id
                     ORDER BY ps2.added_at ASC LIMIT 1) AS first_cover_url
             FROM playlists p
             LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
             WHERE p.user_id = ?
             GROUP BY p.id
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );
        return rows;
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
