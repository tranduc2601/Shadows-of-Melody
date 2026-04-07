import express from 'express';
import * as songController from '../controllers/songController.js';
import { uploadSong } from '../controllers/uploadController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { uploadAudio } from '../config/multer.js';

const router = express.Router();

// Public routes
router.get('/', songController.getAllSongs);
router.get('/genres', songController.getGenres);
router.get('/search', searchLimiter, songController.searchSongs);
router.get('/by-genre/:genreId', songController.getSongsByGenre);
router.get('/:id', songController.getSongById);

// Protected routes
router.post('/history', authMiddleware, songController.addToHistory);

// Admin routes
router.post('/upload', authMiddleware, adminMiddleware, uploadAudio.single('audio'), uploadSong);
router.post('/', authMiddleware, adminMiddleware, songController.createSong);
router.put('/:id', authMiddleware, adminMiddleware, songController.updateSong);
router.delete('/:id', authMiddleware, adminMiddleware, songController.deleteSong);

export default router;
