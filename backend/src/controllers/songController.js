import Song from '../models/Song.js';
import History from '../models/History.js';
import { sanitizeSearchQuery } from '../utils/validators.js';

export const getAllSongs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const songs = await Song.findAll(limit, offset);
        const totalCount = await Song.countTotal();

        return res.status(200).json({
            success: true,
            data: songs,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
            },
        });
    } catch (error) {
        console.error('GetAllSongs error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch songs',
        });
    }
};

export const getSongById = async (req, res) => {
    try {
        const { id } = req.params;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: song,
        });
    } catch (error) {
        console.error('GetSongById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch song',
        });
    }
};

export const searchSongs = async (req, res) => {
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
        const songs = await Song.search(query, limit, offset);

        return res.status(200).json({
            success: true,
            data: songs,
            query: q,
        });
    } catch (error) {
        console.error('SearchSongs error:', error);
        return res.status(500).json({
            success: false,
            message: 'Search failed',
        });
    }
};

export const createSong = async (req, res) => {
    try {
        const { title, album_id, duration, file_url, file_size, cover_url, artists, genres } = req.body;

        if (!title || !duration || !file_url) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, duration, file_url',
            });
        }

        const songId = await Song.create({
            title,
            album_id: album_id || null,
            duration,
            file_url,
            file_size,
            cover_url,
        });

        // Add artists
        if (Array.isArray(artists)) {
            for (const artistId of artists) {
                await Song.addArtist(songId, artistId);
            }
        }

        // Add genres
        if (Array.isArray(genres)) {
            for (const genreId of genres) {
                await Song.addGenre(songId, genreId);
            }
        }

        const song = await Song.findById(songId);

        return res.status(201).json({
            success: true,
            message: 'Song created successfully',
            data: song,
        });
    } catch (error) {
        console.error('CreateSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create song',
        });
    }
};

export const updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, album_id, duration, cover_url } = req.body;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (album_id !== undefined) updateData.album_id = album_id;
        if (duration) updateData.duration = duration;
        if (cover_url) updateData.cover_url = cover_url;

        await Song.update(id, updateData);

        const updatedSong = await Song.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Song updated successfully',
            data: updatedSong,
        });
    } catch (error) {
        console.error('UpdateSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update song',
        });
    }
};

export const deleteSong = async (req, res) => {
    try {
        const { id } = req.params;

        const song = await Song.findById(id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        await Song.delete(id);

        return res.status(200).json({
            success: true,
            message: 'Song deleted successfully',
        });
    } catch (error) {
        console.error('DeleteSong error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete song',
        });
    }
};

export const addToHistory = async (req, res) => {
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

        // Increment play count
        await Song.incrementPlayCount(songId);

        // Add to history
        const historyId = await History.create(userId, songId);

        return res.status(201).json({
            success: true,
            message: 'Song added to history',
            data: { id: historyId },
        });
    } catch (error) {
        console.error('AddToHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add to history',
        });
    }
};
