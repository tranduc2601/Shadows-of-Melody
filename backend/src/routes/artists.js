import express from 'express';
import * as artistController from '../controllers/artistController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.get('/', artistController.getAllArtists);
router.get('/search', searchLimiter, artistController.searchArtists);
router.get('/:id', artistController.getArtistById);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, artistController.createArtist);
router.put('/:id', authMiddleware, adminMiddleware, artistController.updateArtist);
router.delete('/:id', authMiddleware, adminMiddleware, artistController.deleteArtist);

export default router;
