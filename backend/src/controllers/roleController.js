import { pool } from '../config/database.js';
import { revokeToken } from '../utils/jwt.js';

// ── POST /api/roles/request-artist ───────────────────────────────────────────
export const requestArtist = async (req, res) => {
    const userId = req.user.id;

    if (req.user.role !== 'user') {
        return res.status(400).json({
            success: false,
            message: 'Only users with the "user" role can request artist status',
        });
    }

    try {
        // Enforce one pending request at a time
        const [existing] = await pool.query(
            `SELECT id FROM role_requests WHERE user_id = $1 AND status = 'pending'`,
            [userId],
        );
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'You already have a pending artist request',
            });
        }

        const [rows] = await pool.query(
            `INSERT INTO role_requests (user_id) VALUES ($1) RETURNING id, status, created_at`,
            [userId],
        );

        return res.status(201).json({
            success: true,
            message: 'Artist request submitted',
            data: rows[0],
        });
    } catch (err) {
        console.error('requestArtist error:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit request' });
    }
};

// ── GET /api/roles/my-request ─────────────────────────────────────────────────
export const getMyRequest = async (req, res) => {
    const userId = req.user.id;
    try {
        const [rows] = await pool.query(
            `SELECT id, status, reviewed_at, created_at
             FROM role_requests
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId],
        );
        return res.json({ success: true, data: rows[0] ?? null });
    } catch (err) {
        console.error('getMyRequest error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch request' });
    }
};

// ── GET /api/roles/requests ───────────────────────────────────────────────────
export const listRequests = async (req, res) => {
    const { status = 'pending' } = req.query;
    try {
        const [rows] = await pool.query(
            `SELECT rr.id, rr.user_id, rr.status, rr.reviewed_by, rr.reviewed_at, rr.created_at,
                    u.username, u.email, u.full_name, u.avatar_url
             FROM role_requests rr
             JOIN users u ON u.id = rr.user_id
             WHERE rr.status = $1
             ORDER BY rr.created_at ASC`,
            [status],
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('listRequests error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch requests' });
    }
};

// ── PATCH /api/roles/requests/:id ────────────────────────────────────────────
export const reviewRequest = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    const reviewerId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
    }

    try {
        const [reqRows] = await pool.query(
            `SELECT * FROM role_requests WHERE id = $1`,
            [id],
        );
        if (reqRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        const request = reqRows[0];

        if (request.status !== 'pending') {
            return res.status(409).json({ success: false, message: 'Request already reviewed' });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update request row
        await pool.query(
            `UPDATE role_requests
             SET status = $1, reviewed_by = $2, reviewed_at = NOW()
             WHERE id = $3`,
            [newStatus, reviewerId, id],
        );

        // Promote user on approval
        if (action === 'approve') {
            await pool.query(
                `UPDATE users SET role = 'artist' WHERE id = $1`,
                [request.user_id],
            );

            // Create or update artist profile entry linked to this user
            try {
                const [userInfo] = await pool.query(
                    `SELECT username, full_name, avatar_url FROM users WHERE id = $1`,
                    [request.user_id],
                );
                if (userInfo.length > 0) {
                    const u = userInfo[0];
                    const artistName = u.full_name || u.username;
                    // Check if an artist record already exists for this user_id
                    const [existing] = await pool.query(
                        `SELECT id FROM artists WHERE user_id = $1`,
                        [request.user_id],
                    );
                    if (existing.length === 0) {
                        // No existing record — insert a fresh one
                        await pool.query(
                            `INSERT INTO artists (name, image_url, user_id)
                             VALUES ($1, $2, $3)`,
                            [artistName, u.avatar_url || null, request.user_id],
                        );
                    } else {
                        // Sync name & avatar in case they changed
                        await pool.query(
                            `UPDATE artists SET name = $1, image_url = $2, updated_at = NOW()
                             WHERE user_id = $3`,
                            [artistName, u.avatar_url || null, request.user_id],
                        );
                    }
                }
            } catch (innerErr) {
                // Non-fatal: artist profile creation failed but role was already updated
                console.warn('Could not create artist profile entry:', innerErr.message);
            }
        }

        return res.json({
            success: true,
            message: `Request ${newStatus}`,
            data: { id: Number(id), status: newStatus },
        });
    } catch (err) {
        console.error('reviewRequest error:', err);
        return res.status(500).json({ success: false, message: 'Failed to review request' });
    }
};
