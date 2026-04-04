import express from 'express';
import * as albumController from '../controllers/albumController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', albumController.getAllAlbums);
router.get('/:id', albumController.getAlbumById);
router.get('/artist/:artistId', albumController.getAlbumsByArtist);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, albumController.createAlbum);
router.put('/:id', authMiddleware, adminMiddleware, albumController.updateAlbum);
router.delete('/:id', authMiddleware, adminMiddleware, albumController.deleteAlbum);

export default router;
