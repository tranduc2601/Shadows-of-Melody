import History from '../models/History.js';

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
