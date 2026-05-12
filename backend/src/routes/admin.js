import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getStats, getAnalytics, getUsers, deleteUser, toggleAdmin, getArtists, revokeArtistRole, getArtistContent, getGenres, createGenre, updateGenre, deleteGenre, getAlbums, createAlbum, updateAlbum, deleteAlbum, updateUserRole, toggleSongStatus, getAlbumSongs, updateAlbumSong, toggleLockUser, getAdminSongs, getAdminPlaylists, updateAdminPlaylist, deleteAdminPlaylist, getAdminPlaylistSongs, removeAdminPlaylistSong, updateAdminArtist, deleteAdminArtist } from '../controllers/adminController.js';
import { adminUploadSong, adminUploadCover, adminUpdateSong } from '../controllers/adminSongController.js';
import { listTasks, createTask, updateTaskStatus, getManagers } from '../controllers/taskController.js';
import { uploadAudio, uploadImage } from '../config/multer.js';

const router = express.Router();


router.use(requireAuth, requireRole('manager', 'admin'));

router.get('/stats',                    getStats);
router.get('/analytics',               getAnalytics);
router.get('/users',                    getUsers);
router.delete('/users/:id',             requireRole('admin'), deleteUser);
router.patch('/users/:id/toggle-admin', requireRole('admin'), toggleAdmin);
router.patch('/users/:id/role',         updateUserRole);
router.patch('/users/:id/lock',         requireRole('admin'), toggleLockUser);
router.get('/artists',                   getArtists);
router.get('/artists/:id/content',       getArtistContent);
router.patch('/artists/:id',             requireRole('admin'), updateAdminArtist);
router.delete('/artists/:id',            requireRole('admin'), deleteAdminArtist);
router.patch('/artists/:id/revoke-role', requireRole('admin'), revokeArtistRole);
router.get('/genres',                   getGenres);
router.post('/genres',                  requireRole('admin'), createGenre);
router.put('/genres/:id',               requireRole('admin'), updateGenre);
router.delete('/genres/:id',            requireRole('admin'), deleteGenre);
router.get('/albums',                   getAlbums);
router.post('/albums',                  requireRole('admin'), createAlbum);
router.patch('/albums/:id',             requireRole('admin'), updateAlbum);
router.delete('/albums/:id',            requireRole('admin'), deleteAlbum);


router.get('/songs',                    getAdminSongs);


router.post('/songs/upload', uploadAudio.single('audio'), adminUploadSong);


router.patch('/songs/:id', adminUpdateSong);


router.patch('/songs/:id/status', toggleSongStatus);


router.get('/albums/:id/songs',                    getAlbumSongs);
router.patch('/albums/:albumId/songs/:songId',     requireRole('admin'), updateAlbumSong);


router.get('/playlists',                           getAdminPlaylists);
router.patch('/playlists/:id',                     requireRole('admin'), updateAdminPlaylist);
router.delete('/playlists/:id',                    requireRole('admin'), deleteAdminPlaylist);
router.get('/playlists/:id/songs',                 getAdminPlaylistSongs);
router.delete('/playlists/:playlistId/songs/:songId', requireRole('admin'), removeAdminPlaylistSong);


router.post('/upload/cover', uploadImage.single('cover'), adminUploadCover);


router.get('/managers',            getManagers);
router.get('/tasks',               listTasks);
router.post('/tasks',              requireRole('admin'), createTask);
router.patch('/tasks/:id/status',  updateTaskStatus);

export default router;
