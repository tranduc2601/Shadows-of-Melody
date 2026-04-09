import Artist from '../models/Artist.js';
import { pool } from '../config/database.js';
import { sanitizeSearchQuery } from '../utils/validators.js';

// GET /api/artists/members — returns users with role='artist' for public display
export const getArtistMembers = async (req, res) => {
    try {
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const [rows] = await pool.query(
            `SELECT id, username, full_name, avatar_url
             FROM users
             WHERE role = 'artist' AND deleted_at IS NULL
             ORDER BY created_at DESC
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const artists = await Artist.findAll(limit, offset);

        return res.status(200).json({
            success: true,
            data: artists,
            pagination: {
                page,
                limit,
            },
        });
    } catch (error) {
        console.error('GetAllArtists error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch artists',
        });
    }
};

export const getArtistById = async (req, res) => {
    try {
        const { id } = req.params;

        const artist = await Artist.findById(id);
        if (!artist) {
            return res.status(404).json({
                success: false,
                message: 'Artist not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: artist,
        });
    } catch (error) {
        console.error('GetArtistById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch artist',
        });
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

        const updateData = {};
        if (name) updateData.name = name;
        if (bio) updateData.bio = bio;
        if (image_url) updateData.image_url = image_url;

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
