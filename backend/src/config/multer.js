import multer from 'multer';
import path from 'path';
import config from './env.js';

// Dùng memoryStorage: file được giữ trong RAM dưới dạng Buffer
// và sẽ được đẩy lên Firebase Storage trong controller, không ghi ra đĩa
const memoryStorage = multer.memoryStorage();

function audioFilter(_req, file, cb) {
    const allowed = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed (mp3, wav, flac, aac, ogg, m4a)'));
    }
}

export const uploadAudio = multer({
    storage: memoryStorage,
    fileFilter: audioFilter,
    limits: { fileSize: config.upload.maxFileSize },
});

function imageFilter(_req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, png, webp)'));
    }
}

export const uploadImage = multer({
    storage: memoryStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
