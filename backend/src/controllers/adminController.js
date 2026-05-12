import { pool } from '../config/database.js';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import { revokeToken } from '../utils/jwt.js';

// GET /api/admin/analytics
export const getAnalytics = async (req, res) => {
    try {
        const [
            userGrowthRes,
            listeningActivityRes,
            topSongsRes,
            topArtistsRes,
            genreDistRes,
            revenueTrendsRes,
            subscriptionStatsRes,
            summaryRes,
        ] = await Promise.all([
            // New user registrations per day — last 30 days
            pool.query(`
                SELECT DATE(created_at AT TIME ZONE 'UTC') AS date,
                       COUNT(*)::int AS count
                FROM users
                WHERE deleted_at IS NULL
                  AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at AT TIME ZONE 'UTC')
                ORDER BY date ASC
            `),
            // Plays per day from listening_history — last 30 days
            pool.query(`
                SELECT DATE(played_at AT TIME ZONE 'UTC') AS date,
                       COUNT(*)::int AS plays
                FROM listening_history
                WHERE played_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(played_at AT TIME ZONE 'UTC')
                ORDER BY date ASC
            `),
            // Top 10 songs by plays_count
            pool.query(`
                SELECT s.id, s.title, s.cover_url, s.plays_count,
                       STRING_AGG(DISTINCT a.name, ', ' ORDER BY a.name) AS artist_names
                FROM songs s
                LEFT JOIN song_artists sa ON sa.song_id = s.id
                LEFT JOIN artists a ON a.id = sa.artist_id
                GROUP BY s.id
                ORDER BY s.plays_count DESC
                LIMIT 10
            `),
            // Top 10 artists by total plays of their songs
            pool.query(`
                SELECT a.id, a.name, a.image_url,
                       COALESCE(SUM(s.plays_count), 0)::int AS total_plays,
                       COUNT(DISTINCT sa.song_id)::int AS songs_count
                FROM artists a
                LEFT JOIN song_artists sa ON sa.artist_id = a.id
                LEFT JOIN songs s ON s.id = sa.song_id
                GROUP BY a.id
                ORDER BY total_plays DESC
                LIMIT 10
            `),
            // Genre distribution (songs per genre)
            pool.query(`
                SELECT g.name, COUNT(DISTINCT sg.song_id)::int AS count
                FROM genres g
                LEFT JOIN song_genres sg ON sg.genre_id = g.id
                GROUP BY g.id, g.name
                ORDER BY count DESC
                LIMIT 15
            `),
            // Revenue per month — last 12 months (completed payments only)
            pool.query(`
                SELECT TO_CHAR(DATE_TRUNC('month', payment_date), 'YYYY-MM') AS month,
                       SUM(amount)::float AS total,
                       COUNT(*)::int AS transactions
                FROM payments
                WHERE status = 'completed'
                  AND payment_date >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', payment_date)
                ORDER BY month ASC
            `),
            // Subscription type distribution
            pool.query(`
                SELECT subscription_type, COUNT(*)::int AS count
                FROM subscriptions
                WHERE is_active = TRUE
                GROUP BY subscription_type
                ORDER BY count DESC
            `),
            // Summary aggregates
            pool.query(`
                SELECT
                    (SELECT COALESCE(SUM(plays_count), 0)::int FROM songs)                        AS total_plays,
                    (SELECT COALESCE(SUM(amount), 0)::float FROM payments WHERE status='completed'
                       AND payment_date >= DATE_TRUNC('month', NOW()))                            AS revenue_this_month,
                    (SELECT COUNT(DISTINCT user_id)::int FROM listening_history
                       WHERE played_at >= NOW() - INTERVAL '30 days')                            AS active_listeners,
                    (SELECT COALESCE(SUM(duration_played), 0)::bigint FROM listening_history)    AS total_listening_seconds
            `),
        ]);

        const summary = summaryRes[0][0] ?? {};

        return res.json({
            success: true,
            data: {
                user_growth:         userGrowthRes[0],
                listening_activity:  listeningActivityRes[0],
                top_songs:           topSongsRes[0],
                top_artists:         topArtistsRes[0],
                genre_distribution:  genreDistRes[0],
                revenue_trends:      revenueTrendsRes[0],
                subscription_stats:  subscriptionStatsRes[0],
                summary: {
                    total_plays:            summary.total_plays            ?? 0,
                    revenue_this_month:     summary.revenue_this_month     ?? 0,
                    active_listeners:       summary.active_listeners       ?? 0,
                    total_listening_seconds: summary.total_listening_seconds ?? 0,
                },
            },
        });
    } catch (err) {
        console.error('getAnalytics error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load analytics' });
    }
};

// GET /api/admin/stats
export const getStats = async (req, res) => {
    try {
        // pool.query returns [rows, fields] — unwrap rows[0] for scalar counts
        const [usersRes, songsRes, artistsRes, playlistsRes, recentRes] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS users FROM users WHERE deleted_at IS NULL'),
            pool.query('SELECT COUNT(*)::int AS songs FROM songs'),
            pool.query('SELECT COUNT(*)::int AS artists FROM artists'),
            pool.query('SELECT COUNT(*)::int AS playlists FROM playlists'),
            pool.query(
                `SELECT id, username, full_name, email, is_admin, created_at
                 FROM users WHERE deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 5`
            ),
        ]);
        const users   = usersRes[0][0]?.users   ?? 0;
        const songs   = songsRes[0][0]?.songs   ?? 0;
        const artists = artistsRes[0][0]?.artists ?? 0;
        const playlists = playlistsRes[0][0]?.playlists ?? 0;
        const recentUsers = recentRes[0];
        return res.json({
            success: true,
            data: {
                users_count: users,
                songs_count: songs,
                artists_count: artists,
                playlists_count: playlists,
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
        const page     = Math.max(1, parseInt(req.query.page)  || 1);
        const limit    = Math.min(100, parseInt(req.query.limit) || 10);
        const offset   = (page - 1) * limit;
        const keyword  = (req.query.keyword || req.query.q || '').trim();
        const role     = req.query.role || '';
        const isLocked = req.query.is_locked; // '0', '1', or undefined

        const VALID_SORT  = ['created_at', 'username', 'email', 'role'];
        const VALID_ORDER = ['asc', 'desc'];
        const sortBy  = VALID_SORT.includes(req.query.sortBy)  ? req.query.sortBy  : 'created_at';
        const order   = VALID_ORDER.includes((req.query.order || '').toLowerCase()) ? req.query.order.toLowerCase() : 'desc';

        const conditions = ['deleted_at IS NULL'];
        const params     = [];
        const addParam   = v => { params.push(v); return `$${params.length}`; };

        if (keyword) {
            const p = addParam(`%${keyword}%`);
            conditions.push(`(username ILIKE ${p} OR email ILIKE ${p} OR full_name ILIKE ${p})`);
        }
        if (role) conditions.push(`role = ${addParam(role)}`);
        if (isLocked === '1') conditions.push('is_locked = TRUE');
        if (isLocked === '0') conditions.push('is_locked = FALSE');

        const where = conditions.join(' AND ');
        const filterParams = [...params];
        const limitP  = addParam(limit);
        const offsetP = addParam(offset);

        const [totalRes, usersRes] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE ${where}`, filterParams),
            pool.query(
                `SELECT id, username, email, full_name, avatar_url, is_admin, role, is_verified, is_locked, created_at
                 FROM users WHERE ${where}
                 ORDER BY ${sortBy} ${order} LIMIT ${limitP} OFFSET ${offsetP}`,
                params
            ),
        ]);
        const totalItems = parseInt(totalRes[0][0]?.total ?? 0, 10);
        const users = usersRes[0];

        return res.json({
            success: true,
            data: users,
            meta: { totalItems, totalPages: Math.ceil(totalItems / limit) || 1, currentPage: page, limit },
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

        // Fetch artists from artists table (including linked accounts)
        // UNION with users who have role='artist' but no artist profile yet
        const [artists] = await pool.query(
            `SELECT a.id, a.name, a.bio, a.image_url, a.followers_count, a.user_id,
                    u.username AS linked_username, u.role AS linked_user_role,
                    COUNT(DISTINCT sa.song_id)::int AS songs_count
             FROM artists a
             LEFT JOIN users u ON a.user_id = u.id AND u.deleted_at IS NULL
             LEFT JOIN song_artists sa ON a.id = sa.artist_id
             GROUP BY a.id, a.name, a.bio, a.image_url, a.followers_count, a.user_id, u.username, u.role
             ORDER BY a.name ASC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*)::int AS total FROM artists'
        );

        return res.json({
            success: true,
            data: artists,
            meta: { totalItems: total ?? 0, totalPages: Math.ceil((total ?? 0) / limit) || 1, currentPage: page, limit },
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

// PUT /api/admin/genres/:id
export const updateGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: 'Genre name is required' });
        }

        // Check for duplicate (exclude self)
        const [existing] = await pool.query(
            'SELECT id FROM genres WHERE LOWER(name) = LOWER(?) AND id != ?',
            [name.trim(), id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Genre name already in use' });
        }

        const [result] = await pool.query(
            'UPDATE genres SET name = ?, description = ? WHERE id = ? RETURNING id, name, description',
            [name.trim(), description?.trim() || null, id]
        );
        if (!result.length) {
            return res.status(404).json({ success: false, message: 'Genre not found' });
        }
        return res.json({ success: true, data: result[0] });
    } catch (err) {
        console.error('Admin updateGenre error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update genre' });
    }
};

// DELETE /api/admin/genres/:id
export const deleteGenre = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'DELETE FROM genres WHERE id = ? RETURNING id',
            [id]
        );
        if (!result.length) {
            return res.status(404).json({ success: false, message: 'Genre not found' });
        }
        return res.json({ success: true, message: 'Genre deleted' });
    } catch (err) {
        console.error('Admin deleteGenre error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete genre' });
    }
};

// GET /api/admin/albums
export const getAlbums = async (req, res) => {
    try {
        const [albums] = await pool.query(
            `SELECT al.id, al.title, al.cover_url, al.release_date, al.description,
                    ar.id AS artist_id, ar.name AS artist_name,
                    COUNT(DISTINCT s.id)::int AS songs_count
             FROM albums al
             LEFT JOIN artists ar ON al.artist_id = ar.id
             LEFT JOIN songs s ON s.album_id = al.id
             GROUP BY al.id, ar.id, ar.name
             ORDER BY al.title ASC`
        );
        return res.json({ success: true, data: albums });
    } catch (err) {
        console.error('Admin getAlbums error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load albums' });
    }
};

// PATCH /api/admin/albums/:id
export const updateAlbum = async (req, res) => {
    const { id } = req.params;
    const { title, artist_id, cover_url, release_date, description } = req.body;
    if (!title?.trim()) {
        return res.status(400).json({ success: false, message: 'Album title is required' });
    }
    try {
        const [rows] = await pool.query(
            `UPDATE albums
             SET title = $1, artist_id = $2, cover_url = $3,
                 release_date = $4, description = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING id, title, artist_id, cover_url, release_date, description`,
            [title.trim(), artist_id || null, cover_url || null,
             release_date || null, description?.trim() || null, id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Album not found' });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Admin updateAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update album' });
    }
};

// DELETE /api/admin/albums/:id
export const deleteAlbum = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            `DELETE FROM albums WHERE id = $1 RETURNING id`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Album not found' });
        }
        return res.json({ success: true, message: 'Album deleted successfully' });
    } catch (err) {
        console.error('Admin deleteAlbum error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete album' });
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

        // When promoting to artist, ensure an artists table entry exists
        if (newRole === 'artist') {
            try {
                const [userInfo] = await pool.query(
                    `SELECT username, full_name, avatar_url FROM users WHERE id = $1`,
                    [id],
                );
                if (userInfo.length > 0) {
                    const u = userInfo[0];
                    const artistName = u.full_name || u.username;
                    // Check if an artist record already exists for this user_id
                    const [existing] = await pool.query(
                        `SELECT id FROM artists WHERE user_id = $1`,
                        [id],
                    );
                    if (existing.length === 0) {
                        await pool.query(
                            `INSERT INTO artists (name, image_url, user_id)
                             VALUES ($1, $2, $3)`,
                            [artistName, u.avatar_url || null, id],
                        );
                    } else {
                        // Sync name & avatar in case they changed
                        await pool.query(
                            `UPDATE artists SET name = $1, image_url = $2, updated_at = NOW()
                             WHERE user_id = $3`,
                            [artistName, u.avatar_url || null, id],
                        );
                    }
                }
            } catch (innerErr) {
                // Non-fatal: log but don't fail the role update
                console.warn('Could not create artist profile for user:', innerErr.message);
            }
        }

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

// PATCH /api/admin/users/:id/lock
// Lock or unlock a user account (is_locked toggle)
export const toggleLockUser = async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'Không thể khóa tài khoản của chính mình' });
    }
    try {
        const [[user]] = await pool.query(
            `SELECT id, username, is_locked FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]
        );
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const newLocked = !user.is_locked;
        await pool.query(
            `UPDATE users SET is_locked = $1, updated_at = NOW() WHERE id = $2`, [newLocked, id]
        );
        return res.json({
            success: true,
            data: { id: Number(id), is_locked: newLocked },
            message: newLocked ? `Đã khóa tài khoản "${user.username}"` : `Đã mở khóa tài khoản "${user.username}"`,
        });
    } catch (err) {
        console.error('toggleLockUser error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update account lock status' });
    }
};

// GET /api/admin/songs?page=&limit=&keyword=&status=&artist_id=&genre_id=&sortBy=&order=
export const getAdminSongs = async (req, res) => {
    const page    = Math.max(1, parseInt(req.query.page)   || 1);
    const limit   = Math.min(200, parseInt(req.query.limit) || 20);
    const offset  = (page - 1) * limit;
    const keyword = (req.query.keyword || req.query.q || '').trim();
    const status  = req.query.status || '';  // 'published' | 'suppressed' | ''
    const artistId = parseInt(req.query.artist_id) || 0;
    const genreId  = parseInt(req.query.genre_id)  || 0;

    const VALID_SORT  = ['title', 'plays_count', 'created_at', 'duration'];
    const VALID_ORDER = ['asc', 'desc'];
    const sortBy  = VALID_SORT.includes(req.query.sortBy)  ? `s.${req.query.sortBy}`  : 's.created_at';
    const order   = VALID_ORDER.includes((req.query.order || '').toLowerCase()) ? req.query.order.toLowerCase() : 'desc';

    try {
        const conditions = [];
        const params     = [];
        const addParam   = v => { params.push(v); return `$${params.length}`; };

        if (keyword) conditions.push(`(s.tsv @@ plainto_tsquery('simple', unaccent(${addParam(keyword)})) OR s.title ILIKE ${addParam('%' + keyword + '%')})`);
        if (status)   conditions.push(`s.status = ${addParam(status)}`);
        if (artistId) conditions.push(`EXISTS (SELECT 1 FROM song_artists sa2 WHERE sa2.song_id = s.id AND sa2.artist_id = ${addParam(artistId)})`);
        if (genreId)  conditions.push(`EXISTS (SELECT 1 FROM song_genres sg2 WHERE sg2.song_id = s.id AND sg2.genre_id = ${addParam(genreId)})`);

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const filterParams = [...params];
        const limitP  = addParam(limit);
        const offsetP = addParam(offset);

        const [[countRow], [songs]] = await Promise.all([
            pool.query(`SELECT COUNT(DISTINCT s.id)::int AS total FROM songs s ${where}`, filterParams),
            pool.query(
                `SELECT s.id, s.title, s.duration, s.cover_url, s.plays_count, s.status, s.created_at,
                        STRING_AGG(DISTINCT a.name, ', ' ORDER BY a.name) AS artist_names,
                        al.title AS album_title
                 FROM songs s
                 LEFT JOIN song_artists sa ON s.id = sa.song_id
                 LEFT JOIN artists a       ON sa.artist_id = a.id
                 LEFT JOIN albums al       ON s.album_id = al.id
                 ${where}
                 GROUP BY s.id, al.title
                 ORDER BY ${sortBy} ${order}
                 LIMIT ${limitP} OFFSET ${offsetP}`,
                params
            ),
        ]);
        const totalItems = countRow[0]?.total ?? 0;
        return res.json({
            success: true,
            data: songs,
            meta: { totalItems, totalPages: Math.ceil(totalItems / limit) || 1, currentPage: page, limit },
        });
    } catch (err) {
        console.error('getAdminSongs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load songs' });
    }
};

export const toggleSongStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['published', 'suppressed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
    }
    try {
        const [rows] = await pool.query(
            `UPDATE songs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, status`,
            [status, id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('toggleSongStatus error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update song status' });
    }
};

// GET /api/admin/albums/:id/songs
// Returns songs in this album + all songs (for add/remove UI)
export const getAlbumSongs = async (req, res) => {
    const { id } = req.params;
    try {
        const [[albumRow]] = await pool.query(
            `SELECT id, title FROM albums WHERE id = $1`, [id]
        );
        if (!albumRow) return res.status(404).json({ success: false, message: 'Album not found' });

        const [albumSongs] = await pool.query(
            `SELECT s.id, s.title, s.duration, s.cover_url, s.plays_count,
                    STRING_AGG(DISTINCT a.name, ', ') AS artist_names
             FROM songs s
             LEFT JOIN song_artists sa ON sa.song_id = s.id
             LEFT JOIN artists a ON a.id = sa.artist_id
             WHERE s.album_id = $1
             GROUP BY s.id
             ORDER BY s.title ASC`,
            [id]
        );

        const [allSongs] = await pool.query(
            `SELECT s.id, s.title, s.duration, s.cover_url, s.album_id,
                    STRING_AGG(DISTINCT a.name, ', ') AS artist_names,
                    al.title AS album_title
             FROM songs s
             LEFT JOIN song_artists sa ON sa.song_id = s.id
             LEFT JOIN artists a ON a.id = sa.artist_id
             LEFT JOIN albums al ON al.id = s.album_id
             GROUP BY s.id, al.title
             ORDER BY s.title ASC
             LIMIT 200`,
            []
        );

        return res.json({
            success: true,
            data: {
                album: albumRow,
                album_songs: albumSongs,
                all_songs: allSongs,
            },
        });
    } catch (err) {
        console.error('getAlbumSongs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load album songs' });
    }
};

// PATCH /api/admin/albums/:albumId/songs/:songId
// Add or remove a song from the album (action: 'add' | 'remove')
export const updateAlbumSong = async (req, res) => {
    const { albumId, songId } = req.params;
    const { action } = req.body; // 'add' | 'remove'
    if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be "add" or "remove"' });
    }
    try {
        const newAlbumId = action === 'add' ? parseInt(albumId, 10) : null;
        const [rows] = await pool.query(
            `UPDATE songs SET album_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, album_id`,
            [newAlbumId, songId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('updateAlbumSong error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update album song' });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PLAYLISTS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/playlists?page=1&limit=20&keyword=&visibility=&owner_id=
export const getAdminPlaylists = async (req, res) => {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 20);
    const offset  = (page - 1) * limit;
    const keyword = (req.query.keyword || req.query.q || '').trim();
    const visibility = req.query.visibility || ''; // 'public' | 'private' | ''
    const ownerId = parseInt(req.query.owner_id) || 0;

    const VALID_SORT  = ['name', 'created_at', 'songs_count'];
    const VALID_ORDER = ['asc', 'desc'];
    const sortBy = VALID_SORT.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const order  = VALID_ORDER.includes((req.query.order || '').toLowerCase()) ? req.query.order.toLowerCase() : 'desc';

    try {
        const conditions = [];
        const params     = [];
        const addParam   = v => { params.push(v); return `$${params.length}`; };

        if (keyword) {
            const p = addParam(`%${keyword}%`);
            conditions.push(`(p.name ILIKE ${p} OR u.username ILIKE ${p})`);
        }
        if (visibility === 'public')  conditions.push('p.is_public = TRUE');
        if (visibility === 'private') conditions.push('p.is_public = FALSE');
        if (ownerId) conditions.push(`p.user_id = ${addParam(ownerId)}`);

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const filterParams = [...params];
        const limitP  = addParam(limit);
        const offsetP = addParam(offset);

        // Handle sorting by songs_count (computed field)
        let orderClause;
        if (sortBy === 'songs_count') {
            orderClause = `songs_count ${order}`;
        } else {
            orderClause = `p.${sortBy} ${order}`;
        }

        const [[countRow], [playlists]] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total 
                 FROM playlists p 
                 LEFT JOIN users u ON p.user_id = u.id 
                 ${where}`,
                filterParams
            ),
            pool.query(
                `SELECT p.id, p.name, p.description, p.cover_url, p.is_public, p.created_at, p.updated_at,
                        p.user_id, u.username AS owner_name, u.avatar_url AS owner_avatar,
                        COUNT(ps.song_id)::int AS songs_count
                 FROM playlists p
                 LEFT JOIN users u ON p.user_id = u.id
                 LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
                 ${where}
                 GROUP BY p.id, u.username, u.avatar_url
                 ORDER BY ${orderClause}
                 LIMIT ${limitP} OFFSET ${offsetP}`,
                params
            ),
        ]);

        const totalItems = countRow[0]?.total ?? 0;

        return res.json({
            success: true,
            data: playlists,
            meta: { totalItems, totalPages: Math.ceil(totalItems / limit) || 1, currentPage: page, limit },
        });
    } catch (err) {
        console.error('getAdminPlaylists error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load playlists' });
    }
};

// PATCH /api/admin/playlists/:id
export const updateAdminPlaylist = async (req, res) => {
    const { id } = req.params;
    const { name, description, is_public } = req.body;

    if (name !== undefined && !name?.trim()) {
        return res.status(400).json({ success: false, message: 'Playlist name cannot be empty' });
    }

    try {
        const [[existing]] = await pool.query(
            'SELECT id FROM playlists WHERE id = $1',
            [id]
        );
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Playlist not found' });
        }

        const setClauses = [];
        const setValues  = [];
        if (name?.trim()) {
            setClauses.push(`name = $${setValues.length + 1}`);
            setValues.push(name.trim());
        }
        if (description !== undefined) {
            setClauses.push(`description = $${setValues.length + 1}`);
            setValues.push(description?.trim() || null);
        }
        if (is_public !== undefined) {
            setClauses.push(`is_public = $${setValues.length + 1}`);
            setValues.push(is_public === true || is_public === 'true');
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        setClauses.push('updated_at = NOW()');
        setValues.push(id);

        const [rows] = await pool.query(
            `UPDATE playlists SET ${setClauses.join(', ')} WHERE id = $${setValues.length}
             RETURNING id, name, description, is_public, updated_at`,
            setValues
        );

        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('updateAdminPlaylist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update playlist' });
    }
};

// DELETE /api/admin/playlists/:id
export const deleteAdminPlaylist = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query(
            'DELETE FROM playlists WHERE id = $1 RETURNING id, name',
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Playlist not found' });
        }
        return res.json({ success: true, message: `Playlist "${rows[0].name}" deleted successfully` });
    } catch (err) {
        console.error('deleteAdminPlaylist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete playlist' });
    }
};

// GET /api/admin/playlists/:id/songs
export const getAdminPlaylistSongs = async (req, res) => {
    const { id } = req.params;

    try {
        const [[playlist]] = await pool.query(
            `SELECT p.id, p.name, p.description, p.cover_url, p.is_public, p.user_id,
                    u.username AS owner_name
             FROM playlists p
             LEFT JOIN users u ON p.user_id = u.id
             WHERE p.id = $1`,
            [id]
        );
        if (!playlist) {
            return res.status(404).json({ success: false, message: 'Playlist not found' });
        }

        const [songs] = await pool.query(
            `SELECT s.id, s.title, s.duration, s.cover_url, s.plays_count,
                    STRING_AGG(DISTINCT a.name, ', ' ORDER BY a.name) AS artist_names,
                    ps.added_at
             FROM playlist_songs ps
             JOIN songs s ON ps.song_id = s.id
             LEFT JOIN song_artists sa ON s.id = sa.song_id
             LEFT JOIN artists a ON sa.artist_id = a.id
             WHERE ps.playlist_id = $1
             GROUP BY s.id, ps.added_at
             ORDER BY ps.added_at DESC`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                playlist,
                songs,
                songs_count: songs.length,
            },
        });
    } catch (err) {
        console.error('getAdminPlaylistSongs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load playlist songs' });
    }
};

// DELETE /api/admin/playlists/:playlistId/songs/:songId
export const removeAdminPlaylistSong = async (req, res) => {
    const { playlistId, songId } = req.params;

    try {
        const [rows] = await pool.query(
            'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING playlist_id, song_id',
            [playlistId, songId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Song not found in playlist' });
        }
        return res.json({ success: true, message: 'Song removed from playlist' });
    } catch (err) {
        console.error('removeAdminPlaylistSong error:', err);
        return res.status(500).json({ success: false, message: 'Failed to remove song from playlist' });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ARTISTS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// PATCH /api/admin/artists/:id
export const updateAdminArtist = async (req, res) => {
    const { id } = req.params;
    const { name, bio, image_url } = req.body;

    try {
        // Check artist exists
        const [[artist]] = await pool.query(
            'SELECT id, name, bio, image_url, user_id FROM artists WHERE id = $1',
            [id]
        );
        if (!artist) {
            return res.status(404).json({ success: false, message: 'Artist not found' });
        }

        // Validate name if provided
        if (name !== undefined && !name?.trim()) {
            return res.status(400).json({ success: false, message: 'Artist name cannot be empty' });
        }

        // Check for duplicate name (exclude self)
        if (name?.trim() && name.trim().toLowerCase() !== artist.name.toLowerCase()) {
            const [existing] = await pool.query(
                'SELECT id FROM artists WHERE LOWER(name) = LOWER($1) AND id != $2',
                [name.trim(), id]
            );
            if (existing.length > 0) {
                return res.status(409).json({ success: false, message: 'An artist with this name already exists' });
            }
        }

        // Build update query
        const setClauses = [];
        const setValues  = [];

        if (name?.trim()) {
            setClauses.push(`name = $${setValues.length + 1}`);
            setValues.push(name.trim());
        }
        if (bio !== undefined) {
            setClauses.push(`bio = $${setValues.length + 1}`);
            setValues.push(bio?.trim() || null);
        }
        if (image_url !== undefined) {
            setClauses.push(`image_url = $${setValues.length + 1}`);
            setValues.push(image_url?.trim() || null);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        setClauses.push('updated_at = NOW()');
        setValues.push(id);

        const [rows] = await pool.query(
            `UPDATE artists SET ${setClauses.join(', ')} WHERE id = $${setValues.length}
             RETURNING id, name, bio, image_url, followers_count, user_id, updated_at`,
            setValues
        );

        // If artist is linked to a user, sync name to user's full_name
        if (artist.user_id && name?.trim()) {
            await pool.query(
                'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2',
                [name.trim(), artist.user_id]
            ).catch(() => {}); // Non-fatal if sync fails
        }

        return res.json({
            success: true,
            message: 'Artist updated successfully',
            data: rows[0],
        });
    } catch (err) {
        console.error('updateAdminArtist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update artist' });
    }
};

// DELETE /api/admin/artists/:id
export const deleteAdminArtist = async (req, res) => {
    const { id } = req.params;

    try {
        const [[artist]] = await pool.query(
            'SELECT id, name, user_id FROM artists WHERE id = $1',
            [id]
        );
        if (!artist) {
            return res.status(404).json({ success: false, message: 'Artist not found' });
        }

        // Delete artist
        await pool.query('DELETE FROM artists WHERE id = $1', [id]);

        // If artist was linked to a user, revert their role to 'user'
        if (artist.user_id) {
            await pool.query(
                `UPDATE users SET role = 'user', updated_at = NOW() WHERE id = $1 AND role = 'artist'`,
                [artist.user_id]
            ).catch(() => {}); // Non-fatal
        }

        return res.json({
            success: true,
            message: `Artist "${artist.name}" deleted successfully`,
        });
    } catch (err) {
        console.error('deleteAdminArtist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete artist' });
    }
};
