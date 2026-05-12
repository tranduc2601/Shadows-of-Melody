import { pool } from '../config/database.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryStorage.js';


export const getAnalytics = async (req, res) => {
    const artistId = req.artistId;
    try {
        const [statsRes, monthlyRes, topRes, chartRes] = await Promise.all([
            pool.query(
                `SELECT a.followers_count,
                        COALESCE(SUM(s.plays_count), 0)::bigint AS total_plays,
                        COUNT(DISTINCT s.id)::int AS songs_count
                 FROM artists a
                 LEFT JOIN song_artists sa ON a.id = sa.artist_id
                 LEFT JOIN songs s ON sa.song_id = s.id
                 WHERE a.id = $1
                 GROUP BY a.followers_count`,
                [artistId]
            ),
            pool.query(
                `SELECT COUNT(DISTINCT lh.user_id)::int AS monthly_listeners
                 FROM listening_history lh
                 JOIN song_artists sa ON lh.song_id = sa.song_id
                 WHERE sa.artist_id = $1
                   AND lh.played_at >= NOW() - INTERVAL '30 days'`,
                [artistId]
            ),
            pool.query(
                `SELECT s.id, s.title, s.cover_url, s.plays_count, s.duration, s.status
                 FROM songs s
                 JOIN song_artists sa ON s.id = sa.song_id
                 WHERE sa.artist_id = $1
                 ORDER BY s.plays_count DESC, s.created_at DESC
                 LIMIT 5`,
                [artistId]
            ),
            pool.query(
                `SELECT TO_CHAR(DATE(lh.played_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                        COUNT(*)::int AS plays
                 FROM listening_history lh
                 JOIN song_artists sa ON lh.song_id = sa.song_id
                 WHERE sa.artist_id = $1
                   AND lh.played_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
                 GROUP BY day
                 ORDER BY day ASC`,
                [artistId]
            ),
        ]);

        const statsRow     = statsRes[0][0] ?? {};
        const monthlyCount = monthlyRes[0][0]?.monthly_listeners ?? 0;
        const topSongs     = topRes[0] ?? [];
        const dbChart      = chartRes[0] ?? [];


        const chartMap = {};
        dbChart.forEach(r => { chartMap[r.day] = r.plays; });
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - i);
            const key = d.toISOString().slice(0, 10);
            chartData.push({ day: key, plays: chartMap[key] ?? 0 });
        }

        return res.json({
            success: true,
            data: {
                monthlyListeners: monthlyCount,
                totalPlays:       Number(statsRow.total_plays ?? 0),
                followersCount:   statsRow.followers_count ?? 0,
                songsCount:       statsRow.songs_count ?? 0,
                topSongs,
                chartData,
            },
        });
    } catch (err) {
        console.error('getAnalytics error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load analytics' });
    }
};


export const getProfile = async (req, res) => {
    const artistId = req.artistId;
    try {
        const [rows] = await pool.query(
            `SELECT a.id, a.name, a.bio, a.image_url, a.cover_url, a.followers_count,
                    u.username, u.email
             FROM artists a
             JOIN users u ON a.user_id = u.id
             WHERE a.id = $1`,
            [artistId]
        );
        if (!rows[0]) return res.status(404).json({ success: false, message: 'Artist not found' });
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('getProfile error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
};


export const updateProfile = async (req, res) => {
    const artistId = req.artistId;
    const { name, bio } = req.body;
    const updates = {};
    try {
        if (name?.trim()) updates.name = name.trim();
        if (bio !== undefined) updates.bio = bio;

        const avatarFile = req.files?.avatar?.[0];
        if (avatarFile) {
            const { secureUrl } = await uploadToCloudinary(avatarFile.buffer, 'artist-avatars', 'image');
            updates.image_url = secureUrl;
        }
        const coverFile = req.files?.cover?.[0];
        if (coverFile) {
            const { secureUrl } = await uploadToCloudinary(coverFile.buffer, 'artist-covers', 'image');
            updates.cover_url = secureUrl;
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ success: false, message: 'No changes provided' });
        }

        const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
        const [rows] = await pool.query(
            `UPDATE artists SET ${setClauses}, updated_at = NOW() WHERE id = $1
             RETURNING id, name, bio, image_url, cover_url, followers_count`,
            [artistId, ...Object.values(updates)]
        );
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: 'Artist name already taken' });
        }
        console.error('updateProfile error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
};


export const getSongs = async (req, res) => {
    const artistId = req.artistId;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    try {
        const [countRes, songsRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(DISTINCT s.id)::int AS total
                 FROM songs s JOIN song_artists sa ON s.id = sa.song_id
                 WHERE sa.artist_id = $1`,
                [artistId]
            ),
            pool.query(
                `SELECT s.id, s.title, s.cover_url, s.plays_count, s.duration,
                        s.status, s.created_at,
                        al.title AS album_title, al.id AS album_id,
                        STRING_AGG(DISTINCT g.name, ', ' ORDER BY g.name) AS genre_names
                 FROM songs s
                 JOIN song_artists sa ON s.id = sa.song_id
                 LEFT JOIN albums al ON s.album_id = al.id
                 LEFT JOIN song_genres sg ON s.id = sg.song_id
                 LEFT JOIN genres g ON sg.genre_id = g.id
                 WHERE sa.artist_id = $1
                 GROUP BY s.id, al.title, al.id
                 ORDER BY s.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [artistId, limit, offset]
            ),
        ]);
        const total = countRes[0][0]?.total ?? 0;
        return res.json({
            success: true,
            data: songsRes[0] ?? [],
            meta: { totalItems: total, totalPages: Math.ceil(total / limit) || 1, currentPage: page, limit },
        });
    } catch (err) {
        console.error('getSongs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load songs' });
    }
};


export const uploadSong = async (req, res) => {
    const artistId = req.artistId;
    const audioFile = req.files?.audio?.[0];
    if (!audioFile) return res.status(400).json({ success: false, message: 'Audio file required' });

    const { title, duration, album_id } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    const dur = parseInt(duration, 10);
    if (!dur || dur <= 0) return res.status(400).json({ success: false, message: 'Valid duration (seconds) is required' });

    try {
        const { secureUrl: fileUrl, publicId: filePath, size: fileSize } =
            await uploadToCloudinary(audioFile.buffer, 'songs', 'video');

        let coverUrl = null;
        const coverFile = req.files?.cover?.[0];
        if (coverFile) {
            const r = await uploadToCloudinary(coverFile.buffer, 'covers', 'image');
            coverUrl = r.secureUrl;
        }

        const [songRows] = await pool.query(
            `INSERT INTO songs (title, album_id, duration, file_url, file_path, file_size, cover_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [title.trim(), album_id ? parseInt(album_id) : null, dur, fileUrl, filePath, fileSize, coverUrl]
        );
        const songId = songRows[0].id;

        await pool.query(
            `INSERT INTO song_artists (song_id, artist_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [songId, artistId]
        );

        const [rows] = await pool.query(
            `SELECT s.id, s.title, s.cover_url, s.plays_count, s.duration, s.status, s.created_at,
                    al.title AS album_title
             FROM songs s LEFT JOIN albums al ON s.album_id = al.id
             WHERE s.id = $1`,
            [songId]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('uploadSong error:', err);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
};


export const updateSong = async (req, res) => {
    const artistId = req.artistId;
    const { id }   = req.params;
    try {
        const [ownerRows] = await pool.query(
            `SELECT s.file_path FROM songs s
             JOIN song_artists sa ON s.id = sa.song_id
             WHERE s.id = $1 AND sa.artist_id = $2`,
            [id, artistId]
        );
        if (!ownerRows[0]) return res.status(403).json({ success: false, message: 'You do not own this song' });

        const { title, status } = req.body;
        const updates = {};
        if (title?.trim()) updates.title = title.trim();
        if (['published', 'suppressed'].includes(status)) updates.status = status;

        if (req.file) {
            const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'covers', 'image');
            updates.cover_url = secureUrl;
        }

        if (Object.keys(updates).length) {
            const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
            await pool.query(
                `UPDATE songs SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
                [id, ...Object.values(updates)]
            );
        }

        const [rows] = await pool.query(
            `SELECT s.id, s.title, s.cover_url, s.plays_count, s.duration, s.status, s.created_at,
                    al.title AS album_title,
                    STRING_AGG(DISTINCT g.name, ', ') AS genre_names
             FROM songs s
             LEFT JOIN albums al ON s.album_id = al.id
             LEFT JOIN song_genres sg ON s.id = sg.song_id
             LEFT JOIN genres g ON sg.genre_id = g.id
             WHERE s.id = $1
             GROUP BY s.id, al.title`,
            [id]
        );
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('updateSong error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update song' });
    }
};


export const deleteSong = async (req, res) => {
    const artistId = req.artistId;
    const { id }   = req.params;
    try {
        const [ownerRows] = await pool.query(
            `SELECT s.file_path FROM songs s
             JOIN song_artists sa ON s.id = sa.song_id
             WHERE s.id = $1 AND sa.artist_id = $2`,
            [id, artistId]
        );
        if (!ownerRows[0]) return res.status(403).json({ success: false, message: 'You do not own this song' });

        const filePath = ownerRows[0].file_path;
        await pool.query('DELETE FROM songs WHERE id = $1', [id]);


        if (filePath) {
            deleteFromCloudinary(filePath, 'video').catch(() => {});
        }
        return res.json({ success: true, message: 'Song deleted' });
    } catch (err) {
        console.error('deleteSong error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete song' });
    }
};


export const getAlbums = async (req, res) => {
    const artistId = req.artistId;
    try {
        const [rows] = await pool.query(
            `SELECT a.id, a.title, a.cover_url, a.release_date, a.description,
                    COUNT(DISTINCT s.id)::int AS songs_count
             FROM albums a
             LEFT JOIN songs s ON s.album_id = a.id
             WHERE a.artist_id = $1
             GROUP BY a.id
             ORDER BY a.release_date DESC NULLS LAST, a.created_at DESC`,
            [artistId]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getAlbums error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load albums' });
    }
};


export const createAlbum = async (req, res) => {
    const artistId = req.artistId;
    const { title, release_date, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    try {
        let coverUrl = null;
        if (req.file) {
            const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'album-covers', 'image');
            coverUrl = secureUrl;
        }
        const [rows] = await pool.query(
            `INSERT INTO albums (title, artist_id, cover_url, release_date, description)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, cover_url, release_date, description`,
            [title.trim(), artistId, coverUrl, release_date || null, description || null]
        );
        return res.status(201).json({ success: true, data: { ...rows[0], songs_count: 0 } });
    } catch (err) {
        console.error('createAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create album' });
    }
};


export const updateAlbum = async (req, res) => {
    const artistId = req.artistId;
    const { id }   = req.params;
    try {
        const [ownerRows] = await pool.query(
            'SELECT id FROM albums WHERE id = $1 AND artist_id = $2',
            [id, artistId]
        );
        if (!ownerRows[0]) return res.status(403).json({ success: false, message: 'You do not own this album' });

        const { title, release_date, description } = req.body;
        const updates = {};
        if (title?.trim()) updates.title = title.trim();
        if (release_date !== undefined) updates.release_date = release_date || null;
        if (description !== undefined) updates.description = description;
        if (req.file) {
            const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'album-covers', 'image');
            updates.cover_url = secureUrl;
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ success: false, message: 'No changes provided' });
        }

        const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
        const [rows] = await pool.query(
            `UPDATE albums SET ${setClauses}, updated_at = NOW() WHERE id = $1
             RETURNING id, title, cover_url, release_date, description`,
            [id, ...Object.values(updates)]
        );
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('updateAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update album' });
    }
};


export const deleteAlbum = async (req, res) => {
    const artistId = req.artistId;
    const { id }   = req.params;
    try {
        const [ownerRows] = await pool.query(
            'SELECT id FROM albums WHERE id = $1 AND artist_id = $2',
            [id, artistId]
        );
        if (!ownerRows[0]) return res.status(403).json({ success: false, message: 'You do not own this album' });


        await pool.query('UPDATE songs SET album_id = NULL WHERE album_id = $1', [id]);
        await pool.query('DELETE FROM albums WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Album deleted' });
    } catch (err) {
        console.error('deleteAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete album' });
    }
};
