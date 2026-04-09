import { pool } from '../config/database.js';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import { revokeToken } from '../utils/jwt.js';

// GET /api/admin/stats
export const getStats = async (req, res) => {
    try {
        // pool.query returns [rows, fields] — unwrap rows[0] for scalar counts
        const [usersRes, songsRes, artistsRes, recentRes] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS users FROM users WHERE deleted_at IS NULL'),
            pool.query('SELECT COUNT(*)::int AS songs FROM songs'),
            pool.query('SELECT COUNT(*)::int AS artists FROM artists'),
            pool.query(
                `SELECT id, username, full_name, email, is_admin, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 5`
            ),
        ]);
        const users   = usersRes[0][0]?.users   ?? 0;
        const songs   = songsRes[0][0]?.songs   ?? 0;
        const artists = artistsRes[0][0]?.artists ?? 0;
        const recentUsers = recentRes[0];
        return res.json({
            success: true,
            data: {
                users_count: users,
                songs_count: songs,
                artists_count: artists,
                recent_users: recentUsers,
            },
        });
    } catch (err) {
        console.error('Admin getStats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load stats' });
    }
};

// GET /api/admin/users?page=1&limit=10
export const getUsers = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;

        // pool.query returns [rows, fields]; unwrap scalar count and row array
        const [totalRes, usersRes] = await Promise.all([
            pool.query('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL'),
            pool.query(
                `SELECT id, username, email, full_name, avatar_url, is_admin, role, is_verified, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            ),
        ]);
        const total = parseInt(totalRes[0][0]?.total ?? 0, 10);
        const users = usersRes[0];

        return res.json({
            success: true,
            data: users,
            pagination: { page, limit, total },
        });
    } catch (err) {
        console.error('Admin getUsers error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load users' });
    }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản chính mình' });
        }
        await User.delete(id);
        return res.json({ success: true, message: 'Đã xóa người dùng' });
    } catch (err) {
        console.error('Admin deleteUser error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

// PATCH /api/admin/users/:id/toggle-admin
export const toggleAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Không thể thay đổi quyền của chính mình' });
        }
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        await User.update(id, { is_admin: user.is_admin ? 0 : 1 });
        return res.json({ success: true, data: { is_admin: !user.is_admin } });
    } catch (err) {
        console.error('Admin toggleAdmin error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

// GET /api/admin/artists?page=1&limit=10
export const getArtists = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;

        const [[{ total }], artists] = await Promise.all([
            pool.query('SELECT COUNT(*) AS total FROM artists'),
            pool.query(
                `SELECT a.id, a.name, a.bio, a.image_url, a.followers_count, a.user_id,
                        u.username AS linked_username, u.role AS linked_user_role,
                        COUNT(DISTINCT sa.song_id) AS songs_count
                 FROM artists a
                 LEFT JOIN users u ON a.user_id = u.id AND u.deleted_at IS NULL
                 LEFT JOIN song_artists sa ON a.id = sa.artist_id
                 GROUP BY a.id, u.username, u.role
                 ORDER BY a.name ASC LIMIT $1 OFFSET $2`,
                [limit, offset]
            ),
        ]);

        return res.json({
            success: true,
            data: artists[0],
            pagination: { page, limit, total },
        });
    } catch (err) {
        console.error('Admin getArtists error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load artists' });
    }
};

// PATCH /api/admin/artists/:id/revoke-role
export const revokeArtistRole = async (req, res) => {
    const { id } = req.params;
    try {
        const [[artist]] = await pool.query(
            'SELECT id, user_id FROM artists WHERE id = $1',
            [id]
        );
        if (!artist) {
            return res.status(404).json({ success: false, message: 'Artist not found' });
        }
        if (!artist.user_id) {
            return res.status(400).json({ success: false, message: 'This artist has no linked user account' });
        }
        await pool.query(
            `UPDATE users SET role = 'user', updated_at = NOW() WHERE id = $1`,
            [artist.user_id]
        );
        return res.json({ success: true, message: 'Artist role revoked successfully' });
    } catch (err) {
        console.error('revokeArtistRole error:', err);
        return res.status(500).json({ success: false, message: 'Failed to revoke artist role' });
    }
};

// GET /api/admin/genres
export const getGenres = async (req, res) => {
    try {
        const [genres] = await pool.query(
            'SELECT id, name, description FROM genres ORDER BY name ASC'
        );
        return res.json({ success: true, data: genres });
    } catch (err) {
        console.error('Admin getGenres error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load genres' });
    }
};

// POST /api/admin/genres
export const createGenre = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: 'Genre name is required' });
        }

        // Check for duplicate
        const [existing] = await pool.query(
            'SELECT id FROM genres WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Genre already exists', data: existing[0] });
        }

        const [result] = await pool.query(
            'INSERT INTO genres (name, description) VALUES (?, ?) RETURNING id',
            [name.trim(), description?.trim() || null]
        );
        const id = result[0]?.id ?? result.insertId;

        return res.status(201).json({
            success: true,
            data: { id, name: name.trim(), description: description?.trim() || null },
        });
    } catch (err) {
        console.error('Admin createGenre error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create genre' });
    }
};

// GET /api/admin/albums
export const getAlbums = async (req, res) => {
    try {
        const [albums] = await pool.query(
            `SELECT al.id, al.title, al.cover_url, ar.name AS artist_name
             FROM albums al
             LEFT JOIN artists ar ON al.artist_id = ar.id
             ORDER BY al.title ASC`
        );
        return res.json({ success: true, data: albums });
    } catch (err) {
        console.error('Admin getAlbums error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load albums' });
    }
};

// POST /api/admin/albums
export const createAlbum = async (req, res) => {
    try {
        const { title, artist_id, cover_url, release_date } = req.body;
        if (!title?.trim()) {
            return res.status(400).json({ success: false, message: 'Album title is required' });
        }
        const [rows] = await pool.query(
            `INSERT INTO albums (title, artist_id, cover_url, release_date)
             VALUES ($1, $2, $3, $4)
             RETURNING id, title, artist_id`,
            [title.trim(), artist_id || null, cover_url || null, release_date || null]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Admin createAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create album' });
    }
};

// GET /api/admin/artists/:id/content
export const getArtistContent = async (req, res) => {
    const { id } = req.params;
    try {
        const [[artist]] = await pool.query(
            `SELECT a.id, a.name, a.bio, a.image_url, a.followers_count
             FROM artists a WHERE a.id = $1`,
            [id]
        );
        if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

        const [[{ total_songs }], albums, songs] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) AS total_songs FROM song_artists WHERE artist_id = $1`,
                [id]
            ),
            pool.query(
                `SELECT al.id, al.title, al.cover_url, al.release_date
                 FROM albums al WHERE al.artist_id = $1
                 ORDER BY al.release_date DESC NULLS LAST, al.title ASC`,
                [id]
            ),
            pool.query(
                `SELECT s.id, s.title, s.duration, s.cover_url, s.plays_count,
                        al.title AS album_title
                 FROM songs s
                 JOIN song_artists sa ON sa.song_id = s.id AND sa.artist_id = $1
                 LEFT JOIN albums al ON al.id = s.album_id
                 ORDER BY s.created_at DESC
                 LIMIT 50`,
                [id]
            ),
        ]);

        return res.json({
            success: true,
            data: {
                artist,
                total_songs: parseInt(total_songs) || 0,
                albums: albums[0] || [],
                songs:  songs[0]  || [],
            },
        });
    } catch (err) {
        console.error('getArtistContent error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load artist content' });
    }
};

// PATCH /api/admin/users/:id/role
// Admin: set any role.  Manager: can only promote to 'artist'.
export const updateUserRole = async (req, res) => {
    const requesterId = req.user.id;
    const requesterRole = req.user.role;
    const { id } = req.params;
    const { role: newRole } = req.body;

    const validRoles = ['user', 'artist', 'manager', 'admin'];
    if (!validRoles.includes(newRole)) {
        return res.status(400).json({ success: false, message: `role must be one of: ${validRoles.join(', ')}` });
    }

    // No self-role-change
    if (parseInt(id) === requesterId) {
        return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    // Manager can only promote to artist
    if (requesterRole === 'manager' && newRole !== 'artist') {
        return res.status(403).json({
            success: false,
            message: 'Managers can only promote users to the "artist" role',
        });
    }

    try {
        const target = await User.findById(id);
        if (!target) return res.status(404).json({ success: false, message: 'User not found' });

        // Sync is_admin when changing to/from admin role
        const isAdmin = newRole === 'admin';
        await pool.query(
            `UPDATE users SET role = $1, is_admin = $2 WHERE id = $3`,
            [newRole, isAdmin, id],
        );

        // Revoke the affected user's current token so they must re-login
        // (best-effort: we can only revoke through Authorization header if the
        //  user's token is passed in, so we flag it in the response instead)
        return res.json({
            success: true,
            message: `User role updated to "${newRole}". Their current token remains valid until expiry — they must re-login for the new role to take effect.`,
            data: { id: Number(id), role: newRole },
        });
    } catch (err) {
        console.error('updateUserRole error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update role' });
    }
};
