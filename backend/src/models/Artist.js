import { pool } from '../config/database.js';

class Artist {
    static async create(data) {
        const { name, bio, image_url } = data;
        const [result] = await pool.query(
            'INSERT INTO artists (name, bio, image_url) VALUES (?, ?, ?)',
            [name, bio, image_url]
        );
        return result.insertId;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM artists WHERE id = ?', [id]);
        if (!rows[0]) return null;

        const artist = rows[0];

        // Get songs by artist
        const [songs] = await pool.query(
            `SELECT s.* FROM songs s
             JOIN song_artists sa ON s.id = sa.song_id
             WHERE sa.artist_id = ?
             ORDER BY s.created_at DESC`,
            [id]
        );
        artist.songs = songs;

        return artist;
    }

    static async findAll(limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM artists ORDER BY name ASC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        return rows;
    }

    static async search(query, limit = 20, offset = 0) {
        const [rows] = await pool.query(
            'SELECT * FROM artists WHERE name LIKE ? ORDER BY followers_count DESC LIMIT ? OFFSET ?',
            [`%${query}%`, limit, offset]
        );
        return rows;
    }

    static async update(id, data) {
        const fields = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.values(data);

        await pool.query(
            `UPDATE artists SET ${fields} WHERE id = ?`,
            [...values, id]
        );
    }

    static async incrementFollowers(id) {
        await pool.query('UPDATE artists SET followers_count = followers_count + 1 WHERE id = ?', [id]);
    }

    static async delete(id) {
        await pool.query('DELETE FROM artists WHERE id = ?', [id]);
    }
}

export default Artist;
