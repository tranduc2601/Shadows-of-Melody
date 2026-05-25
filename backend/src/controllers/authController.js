import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { generateToken, revokeToken, decodeToken } from '../utils/jwt.js';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators.js';
import { pool } from '../config/database.js';
import crypto from 'crypto';
import config from '../config/env.js';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';

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

const googleClient = config.google?.clientId ? new OAuth2Client(config.google.clientId) : null;

function buildUsernameFromGoogle(name, email) {
    const base = (name || email?.split('@')[0] || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20);
    return base || `user_${Date.now()}`;
}

async function ensureUniqueUsername(baseUsername) {
    let username = baseUsername;
    let suffix = 0;
    while (await User.findByUsername(username)) {
        suffix += 1;
        const trimmedBase = baseUsername.slice(0, Math.max(1, 20 - String(suffix).length - 1));
        username = `${trimmedBase}_${suffix}`;
    }
    return username;
}

async function syncGoogleUser({ googleSub, email, name, picture, emailVerified }) {
    let user = await User.findByGoogleId(googleSub);
    if (user) {
        const updateData = {};
        if (picture && user.avatar_url !== picture) updateData.avatar_url = picture;
        if (!user.is_verified && emailVerified) updateData.is_verified = true;
        if (!user.auth_provider) updateData.auth_provider = 'google';
        if (Object.keys(updateData).length) {
            await User.update(user.id, updateData);
            user = { ...user, ...updateData };
        }
        return user;
    }

    user = await User.findByEmail(email);
    if (user) {
        const updateData = {
            google_id: googleSub,
            auth_provider: user.auth_provider || 'google',
            is_verified: true,
        };
        if (picture && !user.avatar_url) updateData.avatar_url = picture;
        await User.update(user.id, updateData);
        return { ...user, ...updateData };
    }

    const username = await ensureUniqueUsername(buildUsernameFromGoogle(name, email));
    const userId = await User.createOAuthUser({
        username,
        email,
        avatarUrl: picture || null,
        authProvider: 'google',
        googleId: googleSub,
    });

    return User.findById(userId);
}

export const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential) {
            return res.status(400).json({ success: false, message: 'Google credential is required' });
        }
        if (!googleClient) {
            return res.status(500).json({ success: false, message: 'Google login is not configured' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: config.google.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload?.email || !payload?.sub) {
            return res.status(400).json({ success: false, message: 'Invalid Google account data' });
        }
        if (payload.email_verified === false) {
            return res.status(400).json({ success: false, message: 'Google email is not verified' });
        }

        if (config.google.clientId && payload.aud !== config.google.clientId) {
            return res.status(400).json({ success: false, message: 'Google token audience mismatch' });
        }

        const user = await syncGoogleUser({
            googleSub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            emailVerified: payload.email_verified,
        });

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
            message: 'Google login successful',
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
        console.error('GoogleLogin error:', error);
        return res.status(500).json({ success: false, message: 'Google login failed' });
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

const createMailTransport = () => {
    if (!config.mail.host || !config.mail.user || !config.mail.pass) return null;
    return nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.secure,
        auth: { user: config.mail.user, pass: config.mail.pass },
    });
};

export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(200).json({ success: true, message: 'If an account exists for that email, we sent a reset link.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await User.createPasswordResetToken(user.id, token, expiresAt);

        const resetUrl = `${process.env.PUBLIC_WEB_URL || 'http://localhost:4321'}/reset-password?token=${token}`;
        const transporter = createMailTransport();
        if (transporter) {
            await transporter.sendMail({
                from: config.mail.from,
                to: user.email,
                subject: 'Reset your Shadows of Melody password',
                html: `
                    <p>You requested a password reset for your Shadows of Melody account.</p>
                    <p>Click the link below to set a new password. This link expires in 15 minutes.</p>
                    <p><a href="${resetUrl}">${resetUrl}</a></p>
                    <p>If you didn’t request this, you can ignore this email.</p>
                `,
            });
        }
        return res.status(200).json({
            success: true,
            message: 'If an account exists for that email, we sent a reset link.',
        });
    } catch (error) {
        console.error('RequestPasswordReset error:', error);
        return res.status(500).json({ success: false, message: 'Failed to request password reset' });
    }
};

export const validatePasswordResetToken = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Reset token is required' });
        }
        const tokenRow = await User.findPasswordResetToken(token);
        if (!tokenRow) {
            return res.status(400).json({ success: false, message: 'Invalid reset token' });
        }
        if (new Date(tokenRow.expires_at) <= new Date()) {
            return res.status(400).json({ success: false, message: 'Reset token has expired' });
        }
        return res.status(200).json({ success: true, data: { email: tokenRow.email, username: tokenRow.username } });
    } catch (error) {
        console.error('ValidatePasswordResetToken error:', error);
        return res.status(500).json({ success: false, message: 'Failed to validate reset token' });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body || {};
        if (!token || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Token and new password are required' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }
        if (!validatePassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
        }

        const tokenRow = await User.findPasswordResetToken(token);
        if (!tokenRow) {
            return res.status(400).json({ success: false, message: 'Invalid reset token' });
        }
        if (new Date(tokenRow.expires_at) <= new Date()) {
            return res.status(400).json({ success: false, message: 'Reset token has expired' });
        }

        await User.updatePassword(tokenRow.user_id, password);
        await User.consumePasswordResetToken(token);

        return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('ResetPassword error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
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

export const validateAccountPassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body || {};
        if (!password || !String(password).trim()) {
            return res.status(400).json({ success: false, message: 'Password confirmation is required' });
        }

        const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL', [userId]);
        const userRow = rows[0];
        if (!userRow) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const valid = await User.verifyPassword(password, userRow.password_hash || '');
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        return res.status(200).json({ success: true, message: 'Password verified' });
    } catch (error) {
        console.error('ValidateAccountPassword error:', error);
        return res.status(500).json({ success: false, message: 'Failed to validate password' });
    }
};

export const deleteAccount = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const { password } = req.body || {};
        if (!password || !String(password).trim()) {
            return res.status(400).json({ success: false, message: 'Password confirmation is required' });
        }

        await client.query('BEGIN');
        const userResult = await client.query('SELECT password_hash, role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
        const userRow = userResult.rows[0];
        if (!userRow) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const valid = await User.verifyPassword(password, userRow.password_hash || '');
        if (!valid) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Password is incorrect' });
        }

        await client.query('DELETE FROM favorites WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM listening_history WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = $1)', [userId]);
        await client.query('DELETE FROM playlists WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM payments WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM role_requests WHERE user_id = $1', [userId]);
        // Some deployments do not include optional tables; ignore missing-table errors.
        const optionalCleanup = [
            ['DELETE FROM subscription_history WHERE user_id = $1', [userId]],
            ['DELETE FROM artist_requests WHERE user_id = $1', [userId]],
            ['DELETE FROM artist_follows WHERE user_id = $1', [userId]],
            ['DELETE FROM artist_follows WHERE artist_id = $1', [userId]],
        ];
        for (const [sql, params] of optionalCleanup) {
            try {
                await client.query(sql, params);
            } catch (err) {
                if (err?.code !== '42P01') throw err;
            }
        }

        const artistResult = await client.query('SELECT id FROM artists WHERE user_id = $1', [userId]);
        for (const artist of artistResult.rows) {
            await client.query('DELETE FROM song_artists WHERE artist_id = $1', [artist.id]);
            await client.query('DELETE FROM albums WHERE artist_id = $1', [artist.id]);
            await client.query('DELETE FROM artists WHERE id = $1', [artist.id]);
        }

        await client.query(
            `UPDATE users
             SET deleted_at = NOW(),
                 email = CONCAT('deleted_', id, '@deleted.local'),
                 username = CONCAT('deleted_user_', id),
                 full_name = NULL,
                 avatar_url = NULL,
                 bio = NULL,
                 auth_provider = 'deleted',
                 google_id = NULL,
                 is_admin = FALSE,
                 is_verified = FALSE,
                 role = 'user',
                 is_locked = TRUE,
                 updated_at = NOW()
             WHERE id = $1`,
            [userId]
        );
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
