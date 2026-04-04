import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import Song from '../models/Song.js';

export const streamAudio = async (req, res) => {
    try {
        const { songId } = req.params;

        // Get song info
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        const filePath = path.join(config.upload.uploadDir, song.file_url);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Audio file not found',
            });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Handle range requests for seeking
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg',
            });

            fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes',
            });

            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error('StreamAudio error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to stream audio',
        });
    }
};

export const downloadAudio = async (req, res) => {
    try {
        const { songId } = req.params;

        // Get song info
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found',
            });
        }

        // Check subscription (optional: premium only)
        // const subscription = await Subscription.findByUserId(req.user.id);
        // if(subscription.subscription_type === 'free') {
        //     return res.status(403).json({ message: 'Premium subscription required' });
        // }

        const filePath = path.join(config.upload.uploadDir, song.file_url);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Audio file not found',
            });
        }

        res.download(filePath, `${song.title}.mp3`);
    } catch (error) {
        console.error('DownloadAudio error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to download audio',
        });
    }
};
