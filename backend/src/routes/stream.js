import express from 'express';
import * as streamController from '../controllers/streamController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public streaming (range request support)
router.get('/:songId', streamController.streamAudio);

// Protected download route
router.get('/:songId/download', authMiddleware, streamController.downloadAudio);

export default router;
