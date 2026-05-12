import express from 'express';
import * as artistController from '../controllers/artistController.js';
import { authMiddleware, adminMiddleware, requireAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.get('/', artistController.getAllArtists);
router.get('/members', artistController.getArtistMembers);
router.get('/search', searchLimiter, artistController.searchArtists);

// Authenticated user's followed artists (must be before /:id)
router.get('/following', requireAuth, artistController.getFollowedArtists);

router.get('/:id', artistController.getArtistById);

// Follow routes (require auth)
router.get('/:id/follow',    requireAuth, artistController.getFollowStatus);
router.post('/:id/follow',   requireAuth, artistController.followArtist);
router.delete('/:id/follow', requireAuth, artistController.unfollowArtist);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, artistController.createArtist);
router.put('/:id', authMiddleware, adminMiddleware, artistController.updateArtist);
router.delete('/:id', authMiddleware, adminMiddleware, artistController.deleteArtist);

export default router;
