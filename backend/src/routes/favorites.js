import express from 'express';
import * as favoriteController from '../controllers/favoriteController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (all require authentication)
router.get('/', requireAuth, favoriteController.getFavorites);
router.post('/', requireAuth, favoriteController.addFavorite);

router.get('/:songId/is-favorite', requireAuth, favoriteController.isFavorite);
router.delete('/:songId', requireAuth, favoriteController.removeFavorite);
router.get('/:songId/count', favoriteController.getSongFavoriteCount);

export default router;
