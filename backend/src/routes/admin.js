import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getStats, getUsers, deleteUser, toggleAdmin, getArtists, getGenres, createGenre, getAlbums, updateUserRole } from '../controllers/adminController.js';
import { adminUploadSong, adminUploadCover, adminUpdateSong } from '../controllers/adminSongController.js';
import { listTasks, createTask, updateTaskStatus, getManagers } from '../controllers/taskController.js';
import { uploadAudio, uploadImage } from '../config/multer.js';

const router = express.Router();

// All admin routes require auth + at least manager role
router.use(requireAuth, requireRole('manager', 'admin'));

router.get('/stats',                    getStats);
router.get('/users',                    getUsers);
router.delete('/users/:id',             requireRole('admin'), deleteUser);
router.patch('/users/:id/toggle-admin', requireRole('admin'), toggleAdmin);
router.patch('/users/:id/role',         updateUserRole);
router.get('/artists',                  getArtists);
router.get('/genres',                   getGenres);
router.post('/genres',                  requireRole('admin'), createGenre);
router.get('/albums',                   getAlbums);

// Transactional song upload with PostgreSQL + Cloudinary rollback
router.post('/songs/upload', uploadAudio.single('audio'), adminUploadSong);

// Update song metadata (title, cover, album, genres, artists)
router.patch('/songs/:id', adminUpdateSong);

// Cover image upload → Cloudinary, returns secure URL
router.post('/upload/cover', uploadImage.single('cover'), adminUploadCover);

// Manager tasks
router.get('/managers',            getManagers);
router.get('/tasks',               listTasks);
router.post('/tasks',              requireRole('admin'), createTask);
router.patch('/tasks/:id/status',  updateTaskStatus);

export default router;
