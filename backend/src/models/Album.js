import { pool } from '../config/database.js';

class Album {
    static async create(data) {
        const { title, artist_id, cover_url, release_date, description } = data;
        const [result] = await pool.query(
            'INSERT INTO albums (title, artist_id, cover_url, release_date, description) VALUES (?, ?, ?, ?, ?)',
            [title, artist_id, cover_url, release_date, description]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM albums WHERE id = ?', [id]);
        if (!rows[0]) return null;

        const album = rows[0];

        const [songs] = await pool.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.name, ',') AS artist_names,
                    MAX(al.title) AS album_title
             FROM songs s
             LEFT JOIN albums al ON s.album_id = al.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE s.album_id = ?
               AND (s.status IS NULL OR s.status = 'published')
             GROUP BY s.id
             ORDER BY s.created_at ASC`,
            [id]
        );
        album.songs = songs;

        const [artists] = await pool.query(
            'SELECT id, name, image_url FROM artists WHERE id = ?',
            [album.artist_id]
        );
        album.artist = artists[0];

        return album;
    }

    static async findByArtistId(artistId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM albums WHERE artist_id = ? ORDER BY release_date DESC LIMIT ? OFFSET ?',
            [artistId, limit, offset]
        );
        return rows;
    }

    static async findAll(limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM albums ORDER BY release_date DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        return rows;
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE albums SET ${fields} WHERE id = ?`,
            [...values, id]
        );
    }

    static async delete(id) {
        await pool.query('DELETE FROM albums WHERE id = ?', [id]);
    }
}

export default Album;
