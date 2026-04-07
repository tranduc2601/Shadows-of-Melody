import { pool } from '../config/database.js';
import User from '../models/User.js';
import Artist from '../models/Artist.js';

// GET /api/admin/stats
export const getStats = async (req, res) => {
    try {
        const [[{ users }], [{ songs }], [{ artists }], recentUsers] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS users FROM users WHERE deleted_at IS NULL'),
            pool.query('SELECT COUNT(*)::int AS songs FROM songs'),
            pool.query('SELECT COUNT(*)::int AS artists FROM artists'),
            pool.query(
                `SELECT id, full_name, email, is_admin, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 5`
            ),
        ]);
        return res.json({
            success: true,
            data: {
                users_count: users,
                songs_count: songs,
                artists_count: artists,
                recent_users: recentUsers[0],
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

        const [[{ total }], users] = await Promise.all([
            pool.query('SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL'),
            pool.query(
                `SELECT id, username, email, full_name, is_admin, is_verified, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            ),
        ]);

        return res.json({
            success: true,
            data: users[0],
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
                `SELECT a.id, a.name, a.bio, a.image_url, a.followers_count,
                        COUNT(DISTINCT sa.song_id) AS songs_count
                 FROM artists a
                 LEFT JOIN song_artists sa ON a.id = sa.artist_id
                 GROUP BY a.id
                 ORDER BY a.name ASC LIMIT ? OFFSET ?`,
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
