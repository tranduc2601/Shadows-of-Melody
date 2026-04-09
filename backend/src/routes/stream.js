import express from 'express';
import * as streamController from '../controllers/streamController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Public streaming (range request support)
router.get('/:songId', streamController.streamAudio);

// Protected download route
router.get('/:songId/download', requireAuth, streamController.downloadAudio);

export default router;
