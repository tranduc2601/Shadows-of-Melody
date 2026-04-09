import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { roleRequestLimiter } from '../middleware/rateLimiter.js';
import {
    requestArtist,
    getMyRequest,
    listRequests,
    reviewRequest,
} from '../controllers/roleController.js';

const router = express.Router();

// User: submit artist request (rate-limited to prevent spam)
router.post('/request-artist', requireAuth, roleRequestLimiter, requestArtist);

// User: check own pending request
router.get('/my-request', requireAuth, getMyRequest);

// Manager / Admin: list pending requests
router.get('/requests', requireAuth, requireRole('manager', 'admin'), listRequests);

// Manager / Admin: approve or reject a request
router.patch('/requests/:id', requireAuth, requireRole('manager', 'admin'), reviewRequest);

export default router;
