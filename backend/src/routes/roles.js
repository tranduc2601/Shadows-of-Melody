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


router.post('/request-artist', requireAuth, roleRequestLimiter, requestArtist);


router.get('/my-request', requireAuth, getMyRequest);


router.get('/requests', requireAuth, requireRole('manager', 'admin'), listRequests);


router.patch('/requests/:id', requireAuth, requireRole('manager', 'admin'), reviewRequest);

export default router;
