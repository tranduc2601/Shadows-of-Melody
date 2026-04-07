import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getStats, getUsers, deleteUser, toggleAdmin, getArtists, getGenres, getAlbums } from '../controllers/adminController.js';
import { adminUploadSong, adminUploadCover } from '../controllers/adminSongController.js';
import { uploadAudio, uploadImage } from '../config/multer.js';

const router = express.Router();

// All admin routes require auth + admin
router.use(authMiddleware, adminMiddleware);

router.get('/stats',                    getStats);
router.get('/users',                    getUsers);
router.delete('/users/:id',             deleteUser);
router.patch('/users/:id/toggle-admin', toggleAdmin);
router.get('/artists',                  getArtists);
router.get('/genres',                   getGenres);
router.get('/albums',                   getAlbums);

// Transactional song upload with PostgreSQL + Cloudinary rollback
router.post('/songs/upload', uploadAudio.single('audio'), adminUploadSong);

// Cover image upload → Cloudinary, returns secure URL
router.post('/upload/cover', uploadImage.single('cover'), adminUploadCover);

export default router;
