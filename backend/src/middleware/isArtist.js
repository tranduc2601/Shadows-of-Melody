import { pool } from '../config/database.js';

/**
 * Middleware: requires role === 'artist' or 'admin'.
 * Must be used AFTER requireAuth.
 */
const isArtist = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role !== 'artist' && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Artist access required.',
        });
    }
    next();
};

/**
 * Looks up artists.id for req.user.id and attaches it as req.artistId.
 * Returns 404 if the user has no linked artist profile.
 * Must be used AFTER requireAuth + isArtist.
 */
export const attachArtistId = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            'SELECT id FROM artists WHERE user_id = $1',
            [req.user.id]
        );
        if (!rows[0]) {
            return res.status(404).json({
                success: false,
                message: 'Artist profile not found. Please contact an administrator.',
            });
        }
        req.artistId = rows[0].id;
        next();
    } catch (err) {
        console.error('attachArtistId error:', err);
        next(err);
    }
};

export default isArtist;
