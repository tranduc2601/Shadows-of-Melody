import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js';








export async function uploadToCloudinary(buffer, folder, resourceType = 'video') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,

            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    publicId:  result.public_id,
                    secureUrl: result.secure_url,
                    size:      result.bytes,
                });
            },
        );


        Readable.from(buffer).pipe(uploadStream);
    });
}






export async function deleteFromCloudinary(publicId, resourceType = 'video') {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        console.warn(`[Cloudinary] Không thể xoá "${publicId}":`, err.message);
    }
}

