import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import isArtist, { attachArtistId } from '../middleware/isArtist.js';
import * as studio from '../controllers/studioController.js';

const router = express.Router();
const mem = multer.memoryStorage();

const profileUpload = multer({ storage: mem, limits: { fileSize: 5 * 1024 * 1024 } })
    .fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

const songUpload = multer({ storage: mem, limits: { fileSize: 100 * 1024 * 1024 } })
    .fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

const imageUpload = multer({ storage: mem, limits: { fileSize: 5 * 1024 * 1024 } })
    .single('cover');


router.use(requireAuth, isArtist, attachArtistId);


router.get('/analytics', studio.getAnalytics);


router.get('/profile',  studio.getProfile);
router.put('/profile',  profileUpload, studio.updateProfile);


router.get('/songs',          studio.getSongs);
router.post('/songs',         songUpload,   studio.uploadSong);
router.put('/songs/:id',      imageUpload,  studio.updateSong);
router.delete('/songs/:id',   studio.deleteSong);


router.get('/albums',         studio.getAlbums);
router.post('/albums',        imageUpload,  studio.createAlbum);
router.put('/albums/:id',     imageUpload,  studio.updateAlbum);
router.delete('/albums/:id',  studio.deleteAlbum);

export default router;
