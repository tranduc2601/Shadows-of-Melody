import Song from '../models/Song.js';
import { uploadToCloudinary } from '../utils/cloudinaryStorage.js';

/**
 * POST /api/songs/upload
 * Multipart form-data:
 *   - audio: audio file (required)
 *   - title: string (required)
 *   - duration: number in seconds (required — provided by client after reading metadata)
 *   - artist_ids: JSON array string e.g. "[1,2]"
 *   - album_id: number (optional)
 *   - cover_url: string url (optional)
 */
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

        // Upload buffer lên Cloudinary (resource_type 'video' xử lý được cả audio)
        const { publicId, secureUrl, size } = await uploadToCloudinary(
            req.file.buffer,
            'songs',
            'video',
        );

        // Lưu Cloudinary URL và public_id vào DB
        // file_url  = HTTPS URL trực tiếp phát nhạc
        // file_path = public_id Cloudinary (vd: songs/abcdef) — dùng khi cần xoá
        const songId = await Song.create({
            title:     title.trim(),
            album_id:  album_id ? parseInt(album_id) : null,
            duration:  durationSec,
            file_url:  secureUrl,  // Cloudinary CDN URL
            file_path: publicId,   // vd: songs/abcdef123 — dùng khi xoá
            file_size: size,
            cover_url: cover_url || null,
        });

        // Link artists
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
