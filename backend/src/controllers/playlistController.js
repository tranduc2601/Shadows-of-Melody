import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';

export const getAllPlaylists = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        const playlists = await Playlist.findByUserId(userId, limit, offset);

        return res.status(200).json({
            success: true,
            data: playlists,
            pagination: {
                page,
                limit,
            },
        });
    } catch (error) {
        console.error('GetAllPlaylists error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch playlists',
        });
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

export const createPlaylist = async (req, res) => {
    try {
        const { name, description, cover_url, is_public } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Playlist name required',
            });
        }

        const playlistId = await Playlist.create({
            user_id: userId,
            name,
            description: description || '',
            cover_url,
            is_public: is_public !== undefined ? is_public : true,
        });

        const playlist = await Playlist.findById(playlistId);

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

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (cover_url) updateData.cover_url = cover_url;
        if (is_public !== undefined) updateData.is_public = is_public;

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
