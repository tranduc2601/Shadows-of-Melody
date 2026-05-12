import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import { uploadToCloudinary } from '../utils/cloudinaryStorage.js';

export const getAllPlaylists = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        const playlists = await Playlist.findByUserId(userId, limit, offset);

        return res.status(200).json({
            success: true,
            data: playlists,
            meta: { totalItems: playlists.length, totalPages: 1, currentPage: page, limit },
        });
    } catch (error) {
        console.error('GetAllPlaylists error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch playlists' });
    }
};

export const getPlaylistById = async (req, res) => {
    try {
        const { id } = req.params;

        const playlist = await Playlist.findById(id);
        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found',
            });
        }


        if (!playlist.is_public && playlist.user_id !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: 'This playlist is private.',
            });
        }

        return res.status(200).json({
            success: true,
            data: playlist,
        });
    } catch (error) {
        console.error('GetPlaylistById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch playlist',
        });
    }
};

export const getMyPlaylists = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        const playlists = await Playlist.findByUserIdWithMeta(userId, limit, offset);
        return res.status(200).json({ success: true, data: playlists });
    } catch (error) {
        console.error('GetMyPlaylists error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch playlists' });
    }
};

export const createPlaylist = async (req, res) => {
    try {
        const { name, description, is_public } = req.body;
        const userId = req.user.id;

        const trimmedName = (name || '').trim();
        if (!trimmedName) {
            return res.status(400).json({ success: false, message: 'Playlist name is required.' });
        }
        if (trimmedName.length > 100) {
            return res.status(400).json({ success: false, message: 'Playlist name must be 100 characters or fewer.' });
        }
        if (description && description.length > 500) {
            return res.status(400).json({ success: false, message: 'Description must be 500 characters or fewer.' });
        }


        let cover_url = null;
        console.log('[createPlaylist] req.file:', req.file ? `${req.file.fieldname} / ${req.file.originalname} / ${req.file.size}b` : 'NULL');
        console.log('[createPlaylist] Content-Type:', req.headers['content-type']);
        if (req.file) {
            const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'playlist-covers', 'image');
            cover_url = secureUrl;
            console.log('[createPlaylist] Cloudinary URL:', cover_url);
        }

        const playlistId = await Playlist.create({
            user_id: userId,
            name: trimmedName,
            description: (description || '').trim(),
            cover_url,
            is_public: is_public === 'false' || is_public === false ? false : true,
        });

        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(201).json({
                success: true,
                message: 'Playlist created successfully',
                data: { id: playlistId, name: trimmedName, cover_url, is_public: is_public !== 'false' && is_public !== false },
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Playlist created successfully',
            data: playlist,
        });
    } catch (error) {
        console.error('CreatePlaylist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create playlist',
        });
    }
};

export const updatePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, cover_url, is_public } = req.body;
        const userId = req.user.id;

        const playlist = await Playlist.findById(id);
        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found',
            });
        }

        if (playlist.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to update this playlist',
            });
        }


        let finalCoverUrl = cover_url;
        if (req.file) {
            const { secureUrl } = await uploadToCloudinary(req.file.buffer, 'playlist-covers', 'image');
            finalCoverUrl = secureUrl;
        } else if (req.body.remove_cover === 'true') {
            finalCoverUrl = null;
        } else if (finalCoverUrl === undefined) {

            finalCoverUrl = undefined;
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (finalCoverUrl !== undefined) updateData.cover_url = finalCoverUrl;
        if (is_public !== undefined) updateData.is_public = is_public === 'false' || is_public === false ? false : true;

        await Playlist.update(id, updateData);

        const updatedPlaylist = await Playlist.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Playlist updated successfully',
            data: updatedPlaylist,
        });
    } catch (error) {
        console.error('UpdatePlaylist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update playlist',
        });
    }
};

export const deletePlaylist = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const playlist = await Playlist.findById(id);
        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found',
            });
        }

        if (playlist.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to delete this playlist',
            });
        }

        await Playlist.delete(id);

        return res.status(200).json({
            success: true,
            message: 'Playlist deleted successfully',
        });
    } catch (error) {
        console.error('DeletePlaylist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete playlist',
        });
    }
};

export const addSongToPlaylist = async (req, res) => {
    try {
        const { playlistId } = req.params;
        const { songId } = req.body;
        const userId = req.user.id;

        if (!songId) {
            return res.status(400).json({
                success: false,
                message: 'Song ID required',
            });
        }

        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found',
            });
        }

        if (playlist.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to modify this playlist',
            });
        }


        const alreadyIn = await Playlist.isSongInPlaylist(playlistId, songId);
        if (alreadyIn) {
            return res.status(409).json({ success: false, message: 'Song is already in this playlist.' });
        }

        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        await Playlist.addSong(playlistId, songId);

        return res.status(200).json({
            success: true,
            message: 'Song added to playlist',
        });
    } catch (error) {
        console.error('AddSongToPlaylist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add song to playlist',
        });
    }
};

export const removeSongFromPlaylist = async (req, res) => {
    try {
        const { playlistId, songId } = req.params;
        const userId = req.user.id;

        const playlist = await Playlist.findById(playlistId);
        if (!playlist) {
            return res.status(404).json({
                success: false,
                message: 'Playlist not found',
            });
        }

        if (playlist.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to modify this playlist',
            });
        }

        await Playlist.removeSong(playlistId, songId);

        return res.status(200).json({
            success: true,
            message: 'Song removed from playlist',
        });
    } catch (error) {
        console.error('RemoveSongFromPlaylist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove song from playlist',
        });
    }
};
