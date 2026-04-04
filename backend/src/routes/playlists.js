import express from 'express';
import * as playlistController from '../controllers/playlistController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (all require authentication)
router.get('/', authMiddleware, playlistController.getAllPlaylists);
router.post('/', authMiddleware, playlistController.createPlaylist);

router.get('/:id', authMiddleware, playlistController.getPlaylistById);
router.put('/:id', authMiddleware, playlistController.updatePlaylist);
router.delete('/:id', authMiddleware, playlistController.deletePlaylist);

// Add/remove songs
router.post('/:playlistId/songs', authMiddleware, playlistController.addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', authMiddleware, playlistController.removeSongFromPlaylist);

export default router;
