import Album from '../models/Album.js';

export const getAlbumById = async (req, res) => {
    try {
        const { id } = req.params;

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({
                success: false,
                message: 'Album not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: album,
        });
    } catch (error) {
        console.error('GetAlbumById error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch album',
        });
    }
};

export const getAlbumsByArtist = async (req, res) => {
    try {
        const { artistId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const albums = await Album.findByArtistId(artistId, limit, offset);

        return res.status(200).json({
            success: true,
            data: albums,
            pagination: {
                page,
                limit,
            },
        });
    } catch (error) {
        console.error('GetAlbumsByArtist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch albums',
        });
    }
};

export const getAllAlbums = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const albums = await Album.findAll(limit, offset);

        return res.status(200).json({
            success: true,
            data: albums,
            pagination: {
                page,
                limit,
            },
        });
    } catch (error) {
        console.error('GetAllAlbums error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch albums',
        });
    }
};

export const createAlbum = async (req, res) => {
    try {
        const { title, artist_id, cover_url, release_date, description } = req.body;

        if (!title || !artist_id) {
            return res.status(400).json({
                success: false,
                message: 'Title and artist_id required',
            });
        }

        const albumId = await Album.create({
            title,
            artist_id,
            cover_url,
            release_date,
            description,
        });

        const album = await Album.findById(albumId);

        return res.status(201).json({
            success: true,
            message: 'Album created successfully',
            data: album,
        });
    } catch (error) {
        console.error('CreateAlbum error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create album',
        });
    }
};

export const updateAlbum = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, cover_url, release_date, description } = req.body;

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({
                success: false,
                message: 'Album not found',
            });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (cover_url) updateData.cover_url = cover_url;
        if (release_date) updateData.release_date = release_date;
        if (description) updateData.description = description;

        await Album.update(id, updateData);

        const updatedAlbum = await Album.findById(id);

        return res.status(200).json({
            success: true,
            message: 'Album updated successfully',
            data: updatedAlbum,
        });
    } catch (error) {
        console.error('UpdateAlbum error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update album',
        });
    }
};

export const deleteAlbum = async (req, res) => {
    try {
        const { id } = req.params;

        const album = await Album.findById(id);
        if (!album) {
            return res.status(404).json({
                success: false,
                message: 'Album not found',
            });
        }

        await Album.delete(id);

        return res.status(200).json({
            success: true,
            message: 'Album deleted successfully',
        });
    } catch (error) {
        console.error('DeleteAlbum error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete album',
        });
    }
};
