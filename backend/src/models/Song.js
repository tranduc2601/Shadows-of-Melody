import { pool } from '../config/database.js';

class Song {
    static async create(data) {
        const { title, album_id, duration, file_url, file_size, cover_url } = data;
        const [result] = await pool.query(
            'INSERT INTO songs (title, album_id, duration, file_url, file_size, cover_url) VALUES (?, ?, ?, ?, ?, ?)',
            [title, album_id, duration, file_url, file_size, cover_url]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT s.*, 
                    GROUP_CONCAT(DISTINCT a.id) as artist_ids,
                    GROUP_CONCAT(DISTINCT a.name) as artist_names,
                    GROUP_CONCAT(DISTINCT g.id) as genre_ids,
                    GROUP_CONCAT(DISTINCT g.name) as genre_names
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN song_genres sg ON s.id = sg.song_id
             LEFT JOIN genres g ON sg.genre_id = g.id
             WHERE s.id = ?
             GROUP BY s.id`,
            [id]
        );
        return rows[0];
    }

    static async findAll(limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT s.*, 
                    GROUP_CONCAT(DISTINCT a.id) as artist_ids,
                    GROUP_CONCAT(DISTINCT a.name) as artist_names,
                    al.title as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN albums al ON s.album_id = al.id
             GROUP BY s.id
             ORDER BY s.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return rows;
    }

    static async search(query, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT s.*, 
                    GROUP_CONCAT(DISTINCT a.name) as artist_names,
                    al.title as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN albums al ON s.album_id = al.id
             WHERE MATCH(s.title) AGAINST(? IN BOOLEAN MODE) OR a.name LIKE ? OR al.title LIKE ?
             GROUP BY s.id
             LIMIT ? OFFSET ?`,
            [query, `%${query}%`, `%${query}%`, limit, offset]
        );
        return rows;
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE songs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [...values, id]
        );
    }

    static async incrementPlayCount(id) {
        await pool.query('UPDATE songs SET plays_count = plays_count + 1 WHERE id = ?', [id]);
    }

    static async delete(id) {
        await pool.query('DELETE FROM songs WHERE id = ?', [id]);
    }

    static async countTotal() {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM songs');
        return rows[0].count;
    }

    static async addArtist(songId, artistId) {
        await pool.query('INSERT IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)', [songId, artistId]);
    }

    static async addGenre(songId, genreId) {
        await pool.query('INSERT IGNORE INTO song_genres (song_id, genre_id) VALUES (?, ?)', [songId, genreId]);
    }
}

export default Song;
