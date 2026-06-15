import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { MAX_PHOTOS } from '../middleware/upload.js';

// sharp is optional at runtime: if it fails to load (native build issues), store the original bytes.
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { sharp = null; }

const MAX_DIMENSION = 1600;

async function compress(buffer) {
  if (!sharp) return { data: buffer, width: null, height: null, ext: 'jpg' };
  try {
    const pipeline = sharp(buffer).rotate().resize({
      width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true,
    }).jpeg({ quality: 78 });
    const data = await pipeline.toBuffer();
    const meta = await sharp(data).metadata();
    return { data, width: meta.width ?? null, height: meta.height ?? null, ext: 'jpg' };
  } catch {
    return { data: buffer, width: null, height: null, ext: 'jpg' };
  }
}

// Owner-only: adds compressed photos to a report, enforcing the max-3 total.
export async function addPhotos(tenantId, reportId, userId, files) {
  if (!files?.length) throw ApiError.badRequest('At least one photo is required');

  const { rows } = await query(
    'SELECT reporter_id FROM reports WHERE id = $1 AND tenant_id = $2', [reportId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Report not found');
  if (rows[0].reporter_id !== userId) throw ApiError.forbidden('Not your report');

  const { rows: countRows } = await query(
    'SELECT count(*)::int AS n FROM report_photos WHERE report_id = $1', [reportId]);
  const existing = countRows[0].n;
  if (existing + files.length > MAX_PHOTOS) {
    throw ApiError.badRequest(`A report may have at most ${MAX_PHOTOS} photos (has ${existing})`);
  }

  const dir = path.resolve(env.uploadDir, tenantId);
  await mkdir(dir, { recursive: true });

  const created = [];
  for (const [i, file] of files.entries()) {
    const { data, width, height, ext } = await compress(file.buffer);
    const key = `${tenantId}/${crypto.randomUUID()}.${ext}`;
    await writeFile(path.resolve(env.uploadDir, key), data);
    const isPrimary = existing === 0 && i === 0;
    const { rows: ins } = await query(
      `INSERT INTO report_photos (report_id, storage_key, url, width, height, size_bytes, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, url, width, height, is_primary AS "isPrimary"`,
      [reportId, key, `/uploads/${key}`, width, height, data.length, isPrimary],
    );
    created.push(ins[0]);
  }
  return created;
}
