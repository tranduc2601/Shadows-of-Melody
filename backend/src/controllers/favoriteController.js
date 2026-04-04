import Favorite from '../models/Favorite.js';
import Song from '../models/Song.js';

export const getFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const favorites = await Favorite.findByUserId(userId, limit, offset);
        const totalCount = await Favorite.countByUserId(userId);

        return res.status(200).json({
            success: true,
            data: favorites,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
            },
        });
    } catch (error) {
        console.error('GetFavorites error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch favorites',
        });
    }
};

export const isFavorite = async (req, res) => {
    try {
        const { songId } = req.params;
        const userId = req.user.id;

        const favorite = await Favorite.findByUserAndSong(userId, songId);

        return res.status(200).json({
            success: true,
            data: {
                isFavorite: !!favorite,
            },
        });
    } catch (error) {
        console.error('IsFavorite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check favorite status',
        });
    }
};

export const addFavorite = async (req, res) => {
    try {
        const { songId } = req.body;
        const userId = req.user.id;

        if (!songId) {
            return res.status(400).json({
                success: false,
                message: 'Song ID required',
            });
        }

        // Check if song exists
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        // Check if already favorite
        const existingFavorite = await Favorite.findByUserAndSong(userId, songId);
        if (existingFavorite) {
            return res.status(409).json({
                success: false,
                message: 'Song is already in favorites',
            });
        }

        const favoriteId = await Favorite.create(userId, songId);

        return res.status(201).json({
            success: true,
            message: 'Song added to favorites',
            data: { id: favoriteId },
        });
    } catch (error) {
        console.error('AddFavorite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add favorite',
        });
    }
};

export const removeFavorite = async (req, res) => {
    try {
        const { songId } = req.params;
        const userId = req.user.id;

        const favorite = await Favorite.findByUserAndSong(userId, songId);
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: 'Favorite not found',
            });
        }

        await Favorite.delete(userId, songId);

        return res.status(200).json({
            success: true,
            message: 'Song removed from favorites',
        });
    } catch (error) {
        console.error('RemoveFavorite error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove favorite',
        });
    }
};

export const getSongFavoriteCount = async (req, res) => {
    try {
        const { songId } = req.params;

        const count = await Favorite.countBySongId(songId);

        return res.status(200).json({
            success: true,
            data: {
                count,
            },
        });
    } catch (error) {
        console.error('GetSongFavoriteCount error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get favorite count',
        });
    }
};
