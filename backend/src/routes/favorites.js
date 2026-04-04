import express from 'express';
import * as favoriteController from '../controllers/favoriteController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (all require authentication)
router.get('/', authMiddleware, favoriteController.getFavorites);
router.post('/', authMiddleware, favoriteController.addFavorite);

router.get('/:songId/is-favorite', authMiddleware, favoriteController.isFavorite);
router.delete('/:songId', authMiddleware, favoriteController.removeFavorite);
router.get('/:songId/count', favoriteController.getSongFavoriteCount);

export default router;
