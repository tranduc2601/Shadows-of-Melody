import Song from '../models/Song.js';
import { uploadToCloudinary } from '../utils/cloudinaryStorage.js';











export const uploadSong = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Audio file required' });
        }

        const { title, duration, album_id, cover_url, artist_ids } = req.body;

        if (!title || !duration) {
            return res.status(400).json({ success: false, message: 'title and duration are required' });
        }

        const durationSec = parseInt(duration, 10);
        if (isNaN(durationSec) || durationSec <= 0) {
            return res.status(400).json({ success: false, message: 'duration must be a positive integer (seconds)' });
        }


        const { publicId, secureUrl, size } = await uploadToCloudinary(
            req.file.buffer,
            'songs',
            'video',
        );




        const songId = await Song.create({
            title:     title.trim(),
            album_id:  album_id ? parseInt(album_id) : null,
            duration:  durationSec,
            file_url:  secureUrl,
            file_path: publicId,
            file_size: size,
            cover_url: cover_url || null,
        });


        let artistArr = [];
        try { artistArr = JSON.parse(artist_ids || '[]'); } catch {}
        for (const artistId of artistArr) {
            await Song.addArtist(songId, parseInt(artistId));
        }

        const song = await Song.findById(songId);

        return res.status(201).json({
            success: true,
            message: 'Song uploaded successfully',
            data: song,
        });
    } catch (error) {
        console.error('UploadSong error:', error);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
};
