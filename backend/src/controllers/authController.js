import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { generateToken, revokeToken, decodeToken } from '../utils/jwt.js';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators.js';
import { pool } from '../config/database.js';

export const register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validation
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

        // Check if user exists
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

        // Create user
        const userId = await User.create({
            username,
            email,
            password,
        });

        // Create free subscription
        await Subscription.create(userId, 'free', new Date(), null);

        // Generate token — role defaults to 'user' on registration
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

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required',
            });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Verify password
        const isPasswordValid = await User.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        // Check if account is locked
        if (user.is_locked) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
                code: 'ACCOUNT_LOCKED',
            });
        }

        // Generate token — role is embedded so middleware can check it without a DB round-trip.
        // ⚠ Known limitation: if the user's role is changed, their existing token stays valid
        // until expiry. Use PATCH /api/admin/users/:id/role + ask the user to re-login, or
        // configure a short JWT expiry and use refresh tokens.
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

        const subscription = await Subscription.findByUserId(userId);

        return res.status(200).json({
            success: true,
            data: {
                ...user,
                subscription,
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
        const { username, full_name, bio, avatar_url, current_password, new_password } = req.body;

        // Handle password change
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại là bắt buộc' });
            }
            const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
            const hash = rows[0]?.password_hash;
            const valid = await User.verifyPassword(current_password, hash || '');
            if (!valid) {
                return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
            }
            const bcryptjs = (await import('bcryptjs')).default;
            const newHash = await bcryptjs.hash(new_password, 10);
            await pool.query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newHash, userId]);
            return res.json({ success: true, message: 'Password updated' });
        }

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (full_name !== undefined) updateData.full_name = full_name;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        await User.update(userId, updateData);
        const user = await User.findById(userId);

        // Keep artists table in sync if this user is an artist
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

export const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const { uploadToCloudinary } = await import('../utils/cloudinaryStorage.js');
        const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'avatars', 'image');
        // Persist avatar URL to DB
        await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [secureUrl, req.user.id]);
        // Sync avatar in artists table if this user is an artist
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
