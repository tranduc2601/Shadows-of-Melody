import History from '../models/History.js';
import Song from '../models/Song.js';

export const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const history = await History.findByUserId(userId, limit, offset);
        const totalCount = await History.countByUserId(userId);

        return res.status(200).json({
            success: true,
            data: history,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
            },
        });
    } catch (error) {
        console.error('GetHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch history',
        });
    }
};

export const getRecentSongs = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;

        const songs = await History.getRecentSongs(userId, limit);

        return res.status(200).json({
            success: true,
            data: songs,
        });
    } catch (error) {
        console.error('GetRecentSongs error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch recent songs',
        });
    }
};

export const clearHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { days } = req.query;

        if (days) {
            // Clear history older than X days
            await History.deleteOlderThan(parseInt(days));
        } else {
            // Clear all history for user
            await History.delete(userId);
        }

        return res.status(200).json({
            success: true,
            message: 'History cleared successfully',
        });
    } catch (error) {
        console.error('ClearHistory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear history',
        });
    }
};

/**
 * POST /api/history/play-session
 * Records a completed play session. Only counts toward play_count and history if:
 *  - duration_played >= 30 seconds
 *  - no existing history entry for same user+song in the last 10 minutes
 */
export const recordPlaySession = async (req, res) => {
    try {
        const { song_id, duration_played } = req.body;
        const userId = req.user.id;

        if (!song_id) {
            return res.status(400).json({ success: false, message: 'song_id required' });
        }

        const durationSec = parseInt(duration_played, 10) || 0;

        // Require at least 30 seconds listened
        if (durationSec < 30) {
            return res.status(200).json({ success: true, counted: false, reason: 'too_short' });
        }

        // Check if already counted in last 10 minutes (anti-spam)
        const hasRecent = await History.hasRecentEntry(userId, song_id, 10);
        if (hasRecent) {
            return res.status(200).json({ success: true, counted: false, reason: 'too_recent' });
        }

        // Increment play_count
        await Song.incrementPlayCount(song_id);

        // Add to history
        await History.create(userId, song_id, durationSec);

        return res.status(200).json({ success: true, counted: true });
    } catch (error) {
        console.error('RecordPlaySession error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record session' });
    }
};
