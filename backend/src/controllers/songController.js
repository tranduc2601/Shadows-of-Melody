import Song from '../models/Song.js';
import History from '../models/History.js';
import { sanitizeSearchQuery } from '../utils/validators.js';
import { pool } from '../config/database.js';

export const getAllSongs = async (req, res) => {
    try {
        const page    = Math.max(1, parseInt(req.query.page)   || 1);
        const limit   = Math.min(100, parseInt(req.query.limit) || 20);
        const offset  = (page - 1) * limit;
        const keyword = (req.query.keyword || req.query.q || '').trim();
        const genreId  = parseInt(req.query.genre_id)  || 0;
        const artistId = parseInt(req.query.artist_id) || 0;

        const VALID_SORT  = ['created_at', 'plays_count', 'title', 'duration'];
        const VALID_ORDER = ['asc', 'desc'];
        const sortBy = VALID_SORT.includes(req.query.sortBy)  ? `s.${req.query.sortBy}` : 's.created_at';
        const order  = VALID_ORDER.includes((req.query.order || '').toLowerCase()) ? req.query.order.toLowerCase() : 'desc';

        const conditions = ["(s.status IS NULL OR s.status = 'published')"];
        const params     = [];
        const addParam   = v => { params.push(v); return `$${params.length}`; };

        if (keyword) conditions.push(`(s.tsv @@ plainto_tsquery('simple', unaccent(${addParam(keyword)})) OR s.title ILIKE ${addParam('%' + keyword + '%')})`);
        if (genreId)  conditions.push(`EXISTS (SELECT 1 FROM song_genres sg2 WHERE sg2.song_id = s.id AND sg2.genre_id = ${addParam(genreId)})`);
        if (artistId) conditions.push(`EXISTS (SELECT 1 FROM song_artists sa2 WHERE sa2.song_id = s.id AND sa2.artist_id = ${addParam(artistId)})`);

        const where = `WHERE ${conditions.join(' AND ')}`;
        const filterParams = [...params];
        const limitP  = addParam(limit);
        const offsetP = addParam(offset);

        const [[countRow], [songs]] = await Promise.all([
            pool.query(`SELECT COUNT(DISTINCT s.id)::int AS total FROM songs s ${where}`, filterParams),
            pool.query(
                `SELECT s.*,
                        STRING_AGG(DISTINCT a.id::text, ',') AS artist_ids,
                        STRING_AGG(DISTINCT a.name, ','    ) AS artist_names,
                        STRING_AGG(DISTINCT g.id::text, ',') AS genre_ids,
                        STRING_AGG(DISTINCT g.name, ','    ) AS genre_names,
                        al.title AS album_title
                 FROM songs s
                 LEFT JOIN song_artists sa ON s.id = sa.song_id
                 LEFT JOIN artists a       ON sa.artist_id = a.id
                 LEFT JOIN song_genres sg  ON s.id = sg.song_id
                 LEFT JOIN genres g        ON sg.genre_id = g.id
                 LEFT JOIN albums al       ON s.album_id = al.id
                 ${where}
                 GROUP BY s.id, al.title
                 ORDER BY ${sortBy} ${order}
                 LIMIT ${limitP} OFFSET ${offsetP}`,
                params
            ),
        ]);
        const totalItems = countRow[0]?.total ?? 0;
        return res.status(200).json({
            success: true,
            data: songs,
            meta: { totalItems, totalPages: Math.ceil(totalItems / limit) || 1, currentPage: page, limit },
        });
    } catch (error) {
        console.error('GetAllSongs error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch songs' });
    }
};

export const getSongById = async (req, res) => {
    try {
        const { id } = req.params;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: song,
        });
    } catch (error) {
        console.error('GetSongById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch song',
        });
    }
};

export const searchSongs = async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query required',
            });
        }

        const query = sanitizeSearchQuery(q);
        const songs = await Song.search(query, limit, offset);

        return res.status(200).json({
            success: true,
            data: songs,
            query: q,
        });
    } catch (error) {
        console.error('SearchSongs error:', error);
        return res.status(500).json({
            success: false,
            message: 'Search failed',
        });
    }
};

export const createSong = async (req, res) => {
    try {
        const { title, album_id, duration, file_url, file_size, cover_url, artists, genres } = req.body;

        if (!title || !duration || !file_url) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, duration, file_url',
            });
        }

        const songId = await Song.create({
            title,
            album_id: album_id || null,
            duration,
            file_url,
            file_size,
            cover_url,
        });


        if (Array.isArray(artists)) {
            for (const artistId of artists) {
                await Song.addArtist(songId, artistId);
            }
        }


        if (Array.isArray(genres)) {
            for (const genreId of genres) {
                await Song.addGenre(songId, genreId);
            }
        }

        const song = await Song.findById(songId);

        return res.status(201).json({
            success: true,
            message: 'Song created successfully',
            data: song,
        });
    } catch (error) {
        console.error('CreateSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create song',
        });
    }
};

export const updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, album_id, duration, cover_url } = req.body;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (album_id !== undefined) updateData.album_id = album_id;
        if (duration) updateData.duration = duration;
        if (cover_url) updateData.cover_url = cover_url;

        await Song.update(id, updateData);

        const updatedSong = await Song.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Song updated successfully',
            data: updatedSong,
        });
    } catch (error) {
        console.error('UpdateSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update song',
        });
    }
};

export const deleteSong = async (req, res) => {
    try {
        const { id } = req.params;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        await Song.delete(id);

        return res.status(200).json({
            success: true,
            message: 'Song deleted successfully',
        });
    } catch (error) {
        console.error('DeleteSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete song',
        });
    }
};

export const addToHistory = async (req, res) => {
    try {
        const { songId } = req.body;
        const userId = req.user.id;

        if (!songId) {
            return res.status(400).json({
                success: false,
                message: 'Song ID required',
            });
        }


        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }


        await Song.incrementPlayCount(songId);


        const historyId = await History.create(userId, songId);

        return res.status(201).json({
            success: true,
            message: 'Song added to history',
            data: { id: historyId },
        });
    } catch (error) {
        console.error('AddToHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add to history',
        });
    }
};

export const getGenres = async (req, res) => {
    try {
        const [genres] = await pool.query('SELECT id, name FROM genres ORDER BY name ASC');
        return res.json({ success: true, data: genres });
    } catch (error) {
        console.error('GetGenres error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch genres' });
    }
};

export const getSongsByGenre = async (req, res) => {
    try {
        const { genreId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const songs = await Song.findByGenre(genreId, limit, offset);

        return res.json({ success: true, data: songs });
    } catch (error) {
        console.error('GetSongsByGenre error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch songs by genre' });
    }
};
