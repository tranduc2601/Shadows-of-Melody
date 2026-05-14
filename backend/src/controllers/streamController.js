import Song from '../models/Song.js';
import Subscription from '../models/Subscription.js';

const PREMIUM_ONLY_GENRES = ['lossless', 'hifi'];

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

        if (req.user?.id) {
            const subscription = await Subscription.findByUserId(req.user.id);
            const type = subscription?.subscription_type || 'free';
            const active = !!subscription && (subscription.is_active ?? true) && (!subscription.end_date || new Date(subscription.end_date) > new Date());
            const quality = String(req.query.quality || 'standard');
            if (quality !== 'standard' && !(active && (type === 'premium' || type === 'vip'))) {
                return res.status(402).json({ success: false, message: 'This audio quality requires Premium or VIP subscription' });
            }
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

