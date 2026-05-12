import Song from '../models/Song.js';

export const streamAudio = async (req, res) => {
    try {
        const { songId } = req.params;

        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }

        if (!song.file_url) {
            return res.status(404).json({ success: false, message: 'Audio file not found' });
        }



        return res.redirect(302, song.file_url);
    } catch (error) {
        console.error('StreamAudio error:', error);
        return res.status(500).json({ success: false, message: 'Failed to stream audio' });
    }
};

export const downloadAudio = async (req, res) => {
    try {
        const { songId } = req.params;

        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ success: false, message: 'Song not found' });
        }

        if (!song.file_url) {
            return res.status(404).json({ success: false, message: 'Audio file not found' });
        }


        return res.redirect(302, song.file_url);
    } catch (error) {
        console.error('DownloadAudio error:', error);
        return res.status(500).json({ success: false, message: 'Failed to download audio' });
    }
};

