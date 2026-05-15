import express from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { uploadImage } from '../config/multer.js';

const router = express.Router();


router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.get('/reset-password/validate', authController.validatePasswordResetToken);
router.post('/reset-password', authLimiter, authController.resetPassword);


router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.delete('/account', requireAuth, authController.deleteAccount);
router.post('/upload-avatar', requireAuth, uploadImage.single('avatar'), authController.uploadAvatar);
router.post('/upload-banner', requireAuth, uploadImage.single('banner'), authController.uploadBanner);
router.post('/logout', requireAuth, authController.logout);

export default router;
