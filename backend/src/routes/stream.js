import express from 'express';
import * as streamController from '../controllers/streamController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();


router.get('/:songId', streamController.streamAudio);


router.get('/:songId/download', requireAuth, streamController.downloadAudio);

export default router;
