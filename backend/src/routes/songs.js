import express from 'express';
import * as songController from '../controllers/songController.js';
import { uploadSong } from '../controllers/uploadController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { uploadAudio } from '../config/multer.js';

const router = express.Router();


router.get('/', songController.getAllSongs);
router.get('/genres', songController.getGenres);
router.get('/search', searchLimiter, songController.searchSongs);
router.get('/by-genre/:genreId', songController.getSongsByGenre);
router.get('/:id', songController.getSongById);


router.post('/history', requireAuth, songController.addToHistory);


router.post('/upload', requireAuth, requireRole('artist', 'manager', 'admin'), uploadAudio.single('audio'), uploadSong);
router.post('/', requireAuth, requireRole('artist', 'manager', 'admin'), songController.createSong);
router.put('/:id', requireAuth, requireRole('artist', 'manager', 'admin'), songController.updateSong);
router.delete('/:id', requireAuth, requireRole('artist', 'manager', 'admin'), songController.deleteSong);

export default router;
