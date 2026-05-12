import express from 'express';
import * as playlistController from '../controllers/playlistController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadImage } from '../config/multer.js';

const router = express.Router();


router.get('/me', requireAuth, playlistController.getMyPlaylists);
router.get('/', requireAuth, playlistController.getAllPlaylists);
router.post('/', requireAuth, uploadImage.single('cover'), playlistController.createPlaylist);

router.get('/:id', requireAuth, playlistController.getPlaylistById);
router.put('/:id', requireAuth, uploadImage.single('cover'), playlistController.updatePlaylist);
router.delete('/:id', requireAuth, playlistController.deletePlaylist);


router.post('/:playlistId/songs', requireAuth, playlistController.addSongToPlaylist);
router.delete('/:playlistId/songs/:songId', requireAuth, playlistController.removeSongFromPlaylist);

export default router;
