import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js';

/**
 * Upload buffer lên Cloudinary
 * @param {Buffer} buffer       - nội dung file trong RAM (từ multer memoryStorage)
 * @param {string} folder       - thư mục trên Cloudinary, vd: 'songs' | 'covers'
 * @param {string} resourceType - 'video' cho audio/video, 'image' cho ảnh, 'raw' cho file khác
 * @returns {Promise<{publicId: string, secureUrl: string, size: number}>}
 */
export async function uploadToCloudinary(buffer, folder, resourceType = 'video') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
                // Cloudinary tự detect định dạng từ binary — không cần chỉ định format cứng
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    publicId:  result.public_id,  // vd: songs/abcdef123  — dùng để xoá
                    secureUrl: result.secure_url, // HTTPS URL trực tiếp phát nhạc
                    size:      result.bytes,
                });
            },
        );

        // Chuyển Buffer thành Readable stream để pipe vào Cloudinary
        Readable.from(buffer).pipe(uploadStream);
    });
}

/**
 * Xoá file khỏi Cloudinary theo public_id
 * @param {string} publicId    - vd: 'songs/abcdef123'
 * @param {string} resourceType - phải khớp với lúc upload ('video' | 'image' | 'raw')
 */
export async function deleteFromCloudinary(publicId, resourceType = 'video') {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        console.warn(`[Cloudinary] Không thể xoá "${publicId}":`, err.message);
    }
}

