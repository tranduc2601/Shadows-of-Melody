import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { generateToken, revokeToken, decodeToken } from '../utils/jwt.js';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators.js';
import { pool } from '../config/database.js';

export const register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;


        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        if (!validateUsername(username)) {
            return res.status(400).json({
                success: false,
                message: 'Username must be 3-20 characters (alphanumeric and underscore)',
            });
        }

        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format',
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with uppercase, lowercase, and number',
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match',
            });
        }


        const existingUserEmail = await User.findByEmail(email);
        if (existingUserEmail) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered',
            });
        }

        const existingUserUsername = await User.findByUsername(username);
        if (existingUserUsername) {
            return res.status(409).json({
                success: false,
                message: 'Username already taken',
            });
        }


        const userId = await User.create({
            username,
            email,
            password,
        });


        await Subscription.create(userId, 'free', new Date(), null);


        const token = generateToken({ id: userId, username, email, role: 'user', is_admin: false });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: userId,
                username,
                email,
                token,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            success: false,
            message: 'Registration failed',
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;


        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required',
            });
        }


        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }


        const isPasswordValid = await User.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }


        if (user.is_locked) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
                code: 'ACCOUNT_LOCKED',
            });
        }





        const token = generateToken({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role ?? 'user',
            is_admin: user.is_admin,
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url,
                role: user.role ?? 'user',
                is_admin: user.is_admin,
                token,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed',
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const [subscription, [statsRows]] = await Promise.all([
            Subscription.findByUserId(userId),
            pool.query(
                `SELECT
                    (SELECT COUNT(*)::int  FROM artist_follows     WHERE user_id = $1)  AS following_count,
                    (SELECT COUNT(*)::int  FROM favorites           WHERE user_id = $1)  AS liked_count,
                    (SELECT COUNT(DISTINCT song_id)::int FROM listening_history WHERE user_id = $1)  AS total_songs_listened,
                    (SELECT COALESCE(SUM(duration_played),0)::bigint FROM listening_history
                     WHERE user_id = $1 AND played_at >= DATE_TRUNC('month', NOW()))     AS listening_seconds_month,
                    (SELECT COUNT(DISTINCT song_id)::int FROM listening_history
                     WHERE user_id = $1 AND played_at >= DATE_TRUNC('month', NOW()))     AS songs_this_month`,
                [userId]
            ),
        ]);

        const stats = statsRows[0] || {};

        const subType = subscription?.subscription_type || 'free';
        const isActive = !!subscription && (subscription.is_active ?? true) && (!subscription.end_date || new Date(subscription.end_date) > new Date());
        const subscriptionBadge = {
            subscription_type: subType,
            is_active: isActive,
            status: isActive ? 'active' : 'expired',
            plan_name: subType === 'vip' ? 'VIP' : subType === 'premium' ? 'Premium' : 'Free',
            end_date: subscription?.end_date || null,
        };

        return res.status(200).json({
            success: true,
            data: {
                ...user,
                subscription,
                subscription_badge: subscriptionBadge,
                following_count:          stats.following_count           || 0,
                liked_count:              stats.liked_count                || 0,
                total_songs_listened:     stats.total_songs_listened       || 0,
                listening_seconds_month:  Number(stats.listening_seconds_month || 0),
                songs_this_month:         stats.songs_this_month           || 0,
            },
        });
    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user info',
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, bio, avatar_url, current_password, new_password } = req.body;

        if (new_password !== undefined) {
            if (!current_password) {
                return res.status(400).json({ success: false, message: 'Current password is required' });
            }
            if (!validatePassword(new_password)) {
                return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
            }
            const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
            const hash = rows[0]?.password_hash;
            const valid = await User.verifyPassword(current_password, hash || '');
            if (!valid) {
                return res.status(400).json({ success: false, message: 'Current password is incorrect' });
            }
            const bcryptjs = (await import('bcryptjs')).default;
            const newHash = await bcryptjs.hash(new_password, 10);
            await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newHash, userId]);
        }

        const updateData = {};
        if (username !== undefined) {
            const normalized = String(username).trim();
            if (!validateUsername(normalized)) {
                return res.status(400).json({ success: false, message: 'Username must be 3-20 characters (alphanumeric and underscore)' });
            }
            const existing = await User.findByUsername(normalized);
            if (existing && String(existing.id) !== String(userId)) {
                return res.status(409).json({ success: false, message: 'Username already taken' });
            }
            updateData.username = normalized;
        }
        if (bio !== undefined) {
            const normalized = String(bio).trim();
            if (normalized.length > 300) {
                return res.status(400).json({ success: false, message: 'Bio cannot exceed 300 characters' });
            }
            updateData.bio = normalized;
        }
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

        if (Object.keys(updateData).length === 0) {
            if (new_password !== undefined) {
                const user = await User.findById(userId);
                return res.status(200).json({ success: true, message: 'Password updated', data: user });
            }
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        await User.update(userId, updateData);
        const user = await User.findById(userId);

        if (user && user.role === 'artist') {
            try {
                const artistName = user.full_name || user.username;
                await pool.query(
                    `UPDATE artists SET name = $1, image_url = $2, updated_at = NOW() WHERE user_id = $3`,
                    [artistName, user.avatar_url || null, userId]
                );
            } catch (syncErr) {
                console.warn('Artist sync on profile update failed:', syncErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user,
        });
    } catch (error) {
        console.error('UpdateProfile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
        });
    }
};

export const logout = (req, res) => {
    const token = req._token;
    if (token) {
        const decoded = decodeToken(token);
        revokeToken(token, decoded);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
};

export const uploadBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const { uploadToCloudinary } = await import('../utils/cloudinaryStorage.js');
        const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'banners', 'image');
        await pool.query('UPDATE users SET banner_url = ?, updated_at = NOW() WHERE id = ?', [secureUrl, req.user.id]);
        return res.json({ success: true, data: { url: secureUrl } });
    } catch (error) {
        console.error('UploadBanner error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload banner' });
    }
};

export const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const { uploadToCloudinary } = await import('../utils/cloudinaryStorage.js');
        const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'avatars', 'image');

        await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [secureUrl, req.user.id]);

        try {
            await pool.query(
                `UPDATE artists SET image_url = $1, updated_at = NOW() WHERE user_id = $2`,
                [secureUrl, req.user.id]
            );
        } catch (syncErr) {
            console.warn('Artist sync on avatar upload failed:', syncErr.message);
        }
        return res.json({ success: true, data: { url: secureUrl } });
    } catch (error) {
        console.error('UploadAvatar error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload avatar' });
    }
};

export const deleteAccount = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password confirmation is required' });
        }

        await client.query('BEGIN');
        const [rows] = await client.query('SELECT password_hash, role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
        const userRow = rows[0];
        if (!userRow) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const valid = await User.verifyPassword(password, userRow.password_hash || '');
        if (!valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        await client.query('DELETE FROM artist_follows WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM favorites WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM listening_history WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = $1)', [userId]);
        await client.query('DELETE FROM playlists WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM subscription_history WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM artist_requests WHERE user_id = $1', [userId]);

        const [artistRows] = await client.query('SELECT id FROM artists WHERE user_id = $1', [userId]);
        for (const artist of artistRows) {
            await client.query('DELETE FROM song_artists WHERE artist_id = $1', [artist.id]);
            await client.query('DELETE FROM artist_follows WHERE artist_id = $1', [artist.id]);
            await client.query('DELETE FROM albums WHERE artist_id = $1', [artist.id]);
            await client.query('DELETE FROM artists WHERE id = $1', [artist.id]);
        }

        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        revokeToken(req._token, req.user);
        return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DeleteAccount error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete account' });
    } finally {
        client.release();
    }
};
