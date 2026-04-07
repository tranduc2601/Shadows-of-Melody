import express from 'express';
import * as historyController from '../controllers/historyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (all require authentication)
router.get('/', authMiddleware, historyController.getHistory);
router.get('/recent', authMiddleware, historyController.getRecentSongs);
router.post('/play-session', authMiddleware, historyController.recordPlaySession);
router.delete('/', authMiddleware, historyController.clearHistory);

export default router;
