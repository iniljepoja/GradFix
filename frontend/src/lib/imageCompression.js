// Client-side image downscale + JPEG re-encode before upload. Zero-dependency canvas approach.
// Caps the largest edge at `maxEdge` and re-encodes to JPEG. The backend compresses again with
// sharp; this just keeps the upload small on slow mobile connections. On any failure (unsupported
// format/browser) it returns the original file and lets the backend handle it.
const MAX_EDGE = 1600;
const QUALITY = 0.8;

export async function compressImage(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  if (!file.type?.startsWith('image/')) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  // Keep the original if encoding failed or didn't actually shrink the file.
  if (!blob || blob.size >= file.size) return file;

  const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
