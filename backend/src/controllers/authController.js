import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators.js';

export const register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword, full_name } = req.body;

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
            full_name: full_name || username,
        });

        // Create free subscription
        await Subscription.create(userId, 'free', new Date(), null);

        // Generate token
        const token = generateToken({ id: userId, username, email, is_admin: false });

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

        // Generate token
        const token = generateToken({
            id: user.id,
            username: user.username,
            email: user.email,
            is_admin: user.is_admin,
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
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
        const { full_name, avatar_url, bio } = req.body;

        const updateData = {};
        if (full_name) updateData.full_name = full_name;
        if (avatar_url) updateData.avatar_url = avatar_url;
        if (bio) updateData.bio = bio;

        await User.update(userId, updateData);

        const user = await User.findById(userId);

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
