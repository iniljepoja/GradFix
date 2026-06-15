import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file (pre-compression)
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

// Photos are buffered in memory, then compressed and written to disk by the photo service.
export const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(ApiError.badRequest(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
}).array('photos', MAX_PHOTOS);

// Wrap multer so its errors become ApiError JSON instead of raw 500s.
export function photoUpload(req, res, next) {
  uploadPhotos(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_COUNT') return next(ApiError.badRequest(`Max ${MAX_PHOTOS} photos`));
      if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Photo exceeds 8 MB'));
      return next(ApiError.badRequest(err.message));
    }
    next(err);
  });
}
