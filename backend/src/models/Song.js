import { pool } from '../config/database.js';

class Song {
    static async create(data) {
        const { title, album_id, duration, file_url, file_path = null, file_size, cover_url } = data;
        const [rows] = await pool.query(
            `INSERT INTO songs (title, album_id, duration, file_url, file_path, file_size, cover_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [title, album_id, duration, file_url, file_path, file_size, cover_url]
        );
        return rows[0].id;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.id::text, ',') as artist_ids,
                    STRING_AGG(DISTINCT a.name, ',')     as artist_names,
                    STRING_AGG(DISTINCT g.id::text, ',') as genre_ids,
                    STRING_AGG(DISTINCT g.name, ',')     as genre_names
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
                    STRING_AGG(DISTINCT a.id::text, ',') as artist_ids,
                    STRING_AGG(DISTINCT a.name, ',')     as artist_names,
                    al.title as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN albums al ON s.album_id = al.id
             GROUP BY s.id, al.title
             ORDER BY s.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return rows;
    }

    static async search(query, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.name, ',') as artist_names,
                    al.title as album_title
             FROM songs s
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN albums al ON s.album_id = al.id
             WHERE s.tsv @@ plainto_tsquery('simple', unaccent(?))
                OR a.name ILIKE ?
                OR al.title ILIKE ?
             GROUP BY s.id, al.title
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
            `UPDATE songs SET ${fields}, updated_at = NOW() WHERE id = ?`,
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
        const [rows] = await pool.query('SELECT COUNT(*)::int as count FROM songs');
        return rows[0].count;
    }

    static async addArtist(songId, artistId) {
        await pool.query(
            'INSERT INTO song_artists (song_id, artist_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
            [songId, artistId]
        );
    }

    static async addGenre(songId, genreId) {
        await pool.query(
            'INSERT INTO song_genres (song_id, genre_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
            [songId, genreId]
        );
    }

    static async findByGenre(genreId, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            `SELECT s.*,
                    STRING_AGG(DISTINCT a.name, ',') as artist_names,
                    al.title as album_title
             FROM songs s
             JOIN song_genres sg ON s.id = sg.song_id AND sg.genre_id = ?
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             LEFT JOIN albums al ON s.album_id = al.id
             GROUP BY s.id, al.title
             ORDER BY s.plays_count DESC, s.created_at DESC
             LIMIT ? OFFSET ?`,
            [genreId, limit, offset]
        );
        return rows;
    }
}

export default Song;
