import Artist from '../models/Artist.js';
import { pool } from '../config/database.js';
import { sanitizeSearchQuery } from '../utils/validators.js';

// GET /api/artists/members — returns users with role='artist' for public display
export const getArtistMembers = async (req, res) => {
    try {
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const [rows] = await pool.query(
            `SELECT u.id AS user_id, u.username, u.full_name, u.avatar_url,
                    a.id AS artist_id, a.name AS artist_name, a.followers_count
             FROM users u
             LEFT JOIN artists a ON a.user_id = u.id
             WHERE u.role = 'artist' AND u.deleted_at IS NULL
             ORDER BY u.created_at DESC
             LIMIT ?`,
            [limit]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getArtistMembers error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch artist members' });
    }
};

export const getAllArtists = async (req, res) => {
    try {
        const page    = Math.max(1, parseInt(req.query.page)   || 1);
        const limit   = Math.min(100, parseInt(req.query.limit) || 20);
        const offset  = (page - 1) * limit;
        const keyword = (req.query.keyword || req.query.q || '').trim();

        const VALID_SORT  = ['name', 'followers_count', 'created_at'];
        const VALID_ORDER = ['asc', 'desc'];
        const sortBy = VALID_SORT.includes(req.query.sortBy)  ? req.query.sortBy : 'name';
        const order  = VALID_ORDER.includes((req.query.order || '').toLowerCase()) ? req.query.order.toLowerCase() : 'asc';

        const params   = [];
        const addParam = v => { params.push(v); return `$${params.length}`; };
        const where    = keyword ? `WHERE a.name ILIKE ${addParam('%' + keyword + '%')}` : '';

        const [[countRow], [artists]] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total FROM artists ${keyword ? `WHERE name ILIKE $1` : ''}`, keyword ? [`%${keyword}%`] : []),
            pool.query(
                `SELECT a.id, a.name, a.bio, a.image_url, a.cover_url, a.followers_count, a.user_id,
                        COUNT(DISTINCT lh.user_id)::int AS monthly_listeners
                 FROM artists a
                 LEFT JOIN song_artists sa  ON sa.artist_id = a.id
                 LEFT JOIN listening_history lh ON lh.song_id = sa.song_id
                   AND lh.played_at >= NOW() - INTERVAL '30 days'
                 ${where}
                 GROUP BY a.id
                 ORDER BY a.${sortBy} ${order}
                 LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`,
                params
            ),
        ]);
        const totalItems = countRow[0]?.total ?? 0;

        // Follow status for requesting user
        const token = req.headers.authorization?.split(' ')[1];
        let followedSet = new Set();
        if (token && artists.length) {
            try {
                const { verifyToken } = await import('../utils/jwt.js');
                const decoded = verifyToken(token);
                if (decoded?.id) {
                    const [follows] = await pool.query(
                        `SELECT artist_id FROM artist_follows WHERE user_id = $1`,
                        [decoded.id]
                    );
                    followedSet = new Set(follows.map(r => r.artist_id));
                }
            } catch {}
        }
        const artistsWithFollow = artists.map(a => ({ ...a, is_following: followedSet.has(a.id) }));

        return res.status(200).json({
            success: true,
            data: artistsWithFollow,
            meta: { totalItems, totalPages: Math.ceil(totalItems / limit) || 1, currentPage: page, limit },
        });
    } catch (error) {
        console.error('GetAllArtists error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch artists' });
    }
};

export const getArtistById = async (req, res) => {
    try {
        const { id } = req.params;

        const artist = await Artist.findById(id);
        if (!artist) {
            return res.status(404).json({ success: false, message: 'Artist not found' });
        }

        // Monthly listeners: distinct users who played this artist's songs in the last 30 days
        const [[{ monthly_listeners }]] = await pool.query(
            `SELECT COUNT(DISTINCT lh.user_id)::int AS monthly_listeners
             FROM listening_history lh
             JOIN song_artists sa ON sa.song_id = lh.song_id
             WHERE sa.artist_id = $1
               AND lh.played_at >= NOW() - INTERVAL '30 days'`,
            [id]
        );
        artist.monthly_listeners = monthly_listeners ?? 0;

        // Follow status for the requesting user (optional auth)
        const token = req.headers.authorization?.split(' ')[1];
        let is_following = false;
        if (token) {
            try {
                const { verifyToken } = await import('../utils/jwt.js');
                const decoded = verifyToken(token);
                if (decoded?.id) {
                    const [[row]] = await pool.query(
                        `SELECT 1 FROM artist_follows WHERE user_id = $1 AND artist_id = $2`,
                        [decoded.id, id]
                    );
                    is_following = !!row;
                }
            } catch {}
        }
        artist.is_following = is_following;

        return res.status(200).json({ success: true, data: artist });
    } catch (error) {
        console.error('GetArtistById error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch artist' });
    }
};

// GET /api/artists/:id/follow — check follow status
export const getFollowStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const [[row]] = await pool.query(
            `SELECT 1 FROM artist_follows WHERE user_id = $1 AND artist_id = $2`,
            [userId, id]
        );
        return res.json({ success: true, data: { is_following: !!row } });
    } catch (err) {
        console.error('getFollowStatus error:', err);
        return res.status(500).json({ success: false, message: 'Failed to get follow status' });
    }
};

// POST /api/artists/:id/follow — follow an artist
export const followArtist = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [[artistRow]] = await pool.query('SELECT id, followers_count FROM artists WHERE id = $1', [id]);
        if (!artistRow) return res.status(404).json({ success: false, message: 'Artist not found' });

        // Upsert follow (RETURNING tells us if it was actually inserted)
        const [inserted] = await pool.query(
            `INSERT INTO artist_follows (user_id, artist_id) VALUES ($1, $2)
             ON CONFLICT (user_id, artist_id) DO NOTHING
             RETURNING user_id`,
            [userId, id]
        );
        if (inserted.length > 0) {
            await pool.query(
                `UPDATE artists SET followers_count = followers_count + 1 WHERE id = $1`,
                [id]
            );
        }

        const [[updated]] = await pool.query('SELECT followers_count FROM artists WHERE id = $1', [id]);
        return res.json({
            success: true,
            data: { is_following: true, followers_count: updated.followers_count ?? 0 },
        });
    } catch (err) {
        console.error('followArtist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to follow artist' });
    }
};

// DELETE /api/artists/:id/follow — unfollow an artist
export const unfollowArtist = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [deleted] = await pool.query(
            `DELETE FROM artist_follows WHERE user_id = $1 AND artist_id = $2
             RETURNING user_id`,
            [userId, id]
        );
        if (deleted.length > 0) {
            await pool.query(
                `UPDATE artists SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1`,
                [id]
            );
        }

        const [[updated]] = await pool.query('SELECT followers_count FROM artists WHERE id = $1', [id]);
        return res.json({
            success: true,
            data: { is_following: false, followers_count: updated.followers_count ?? 0 },
        });
    } catch (err) {
        console.error('unfollowArtist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to unfollow artist' });
    }
};

export const searchArtists = async (req, res) => {
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
        const artists = await Artist.search(query, limit, offset);

        return res.status(200).json({
            success: true,
            data: artists,
            query: q,
        });
    } catch (error) {
        console.error('SearchArtists error:', error);
        return res.status(500).json({
            success: false,
            message: 'Search failed',
        });
    }
};

export const createArtist = async (req, res) => {
    try {
        const { name, bio, image_url } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Artist name required',
            });
        }

        const artistId = await Artist.create({
            name,
            bio: bio || '',
            image_url,
        });

        const artist = await Artist.findById(artistId);

        return res.status(201).json({
            success: true,
            message: 'Artist created successfully',
            data: artist,
        });
    } catch (error) {
        console.error('CreateArtist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create artist',
        });
    }
};

export const updateArtist = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bio, image_url } = req.body;

        const artist = await Artist.findById(id);
        if (!artist) {
            return res.status(404).json({
                success: false,
                message: 'Artist not found',
            });
        }

        // Validate name if provided
        if (name !== undefined && !name?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Artist name cannot be empty',
            });
        }

        // Check for duplicate name (exclude self)
        if (name?.trim() && name.trim().toLowerCase() !== artist.name.toLowerCase()) {
            const [existing] = await pool.query(
                'SELECT id FROM artists WHERE LOWER(name) = LOWER($1) AND id != $2',
                [name.trim(), id]
            );
            if (existing.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'An artist with this name already exists',
                });
            }
        }

        const updateData = {};
        if (name?.trim())        updateData.name = name.trim();
        if (bio !== undefined)   updateData.bio = bio?.trim() || null;
        if (image_url !== undefined) updateData.image_url = image_url?.trim() || null;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update',
            });
        }

        await Artist.update(id, updateData);

        const updatedArtist = await Artist.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Artist updated successfully',
            data: updatedArtist,
        });
    } catch (error) {
        console.error('UpdateArtist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update artist',
        });
    }
};

export const deleteArtist = async (req, res) => {
    try {
        const { id } = req.params;

        const artist = await Artist.findById(id);
        if (!artist) {
            return res.status(404).json({
                success: false,
                message: 'Artist not found',
            });
        }

        await Artist.delete(id);

        return res.status(200).json({
            success: true,
            message: 'Artist deleted successfully',
        });
    } catch (error) {
        console.error('DeleteArtist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete artist',
        });
    }
};

// GET /api/artists/following — artists the authenticated user follows
export const getFollowedArtists = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query(
            `SELECT a.id, a.name, a.bio, a.image_url, a.cover_url, a.followers_count,
                    COUNT(DISTINCT lh.user_id)::int AS monthly_listeners,
                    TRUE AS is_following
             FROM artist_follows af
             JOIN artists a ON a.id = af.artist_id
             LEFT JOIN song_artists sa ON sa.artist_id = a.id
             LEFT JOIN listening_history lh
                    ON lh.song_id = sa.song_id
                   AND lh.played_at >= NOW() - INTERVAL '30 days'
             WHERE af.user_id = $1
             GROUP BY a.id, af.created_at
             ORDER BY af.created_at DESC`,
            [userId]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('getFollowedArtists error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch followed artists' });
    }
};
