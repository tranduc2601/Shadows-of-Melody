import express from 'express';
import * as historyController from '../controllers/historyController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();


router.get('/', requireAuth, historyController.getHistory);
router.post('/', requireAuth, historyController.logPlay);
router.get('/recent', requireAuth, historyController.getRecentSongs);
router.post('/play-session', requireAuth, historyController.recordPlaySession);
router.delete('/', requireAuth, historyController.clearHistory);

export default router;
