import express from 'express';
import * as playlistController from '../controllers/playlistController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (all require authentication)
router.get('/', requireAuth, playlistController.getAllPlaylists);
router.post('/', requireAuth, playlistController.createPlaylist);

router.get('/:id', requireAuth, playlistController.getPlaylistById);
router.put('/:id', requireAuth, playlistController.updatePlaylist);
router.delete('/:id', requireAuth, playlistController.deletePlaylist);

// Add/remove songs
router.post('/:playlistId/songs', requireAuth, playlistController.addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', requireAuth, playlistController.removeSongFromPlaylist);

export default router;
