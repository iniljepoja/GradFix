import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

// pdfkit is optional at runtime: if it fails to load, we still build a text snapshot and
// store a minimal PDF-like buffer is not possible, so we fall back to a UTF-8 text document
// (still immutable, checksummed, versioned). The real PDF path is used when pdfkit loads.
let PDFDocument = null;
try { PDFDocument = (await import('pdfkit')).default; } catch { PDFDocument = null; }

// Build the immutable snapshot persisted with each PDF version. Per the Work Order gist's
// security requirements, reporter PII is NOT included by default (only a display name).
export async function buildSnapshot(client, tenantId, workOrderId) {
  const run = client ?? { query };
  const { rows } = await run.query(
    `SELECT wo.id, wo.title AS "workOrderTitle", wo.description AS "workOrderDescription",
            wo.status, wo.due_at AS "dueAt", wo.created_at AS "workOrderCreatedAt",
            wo.responsible_entity_id AS "entityId", e.name AS "entityName",
            e.type AS "entityType", e.email AS "entityEmail", e.phone AS "entityPhone",
            r.id AS "reportId", r.title AS "reportTitle", r.description AS "reportDescription",
            r.status AS "reportStatus", r.priority, r.address,
            r.latitude, r.longitude,
            c.name AS "categoryName", s.name AS "subcategoryName",
            u.full_name AS "reporterName"
     FROM work_orders wo
     JOIN reports r ON r.id = wo.report_id AND r.tenant_id = wo.tenant_id
     JOIN responsible_entities e ON e.id = wo.responsible_entity_id AND e.tenant_id = wo.tenant_id
     LEFT JOIN categories c ON c.id = r.category_id
     LEFT JOIN subcategories s ON s.id = r.subcategory_id
     LEFT JOIN users u ON u.id = r.reporter_id
     WHERE wo.id = $1 AND wo.tenant_id = $2`,
    [workOrderId, tenantId],
  );
  if (!rows[0]) throw ApiError.notFound('Work order not found');
  const s = rows[0];
  const { rows: photos } = await run.query(
    `SELECT id, storage_key AS "storageKey", url
     FROM report_photos
     WHERE report_id = $1
     ORDER BY is_primary DESC, created_at`,
    [s.reportId],
  );
  return {
    workOrderId: s.id,
    workOrderTitle: s.workOrderTitle,
    workOrderDescription: s.workOrderDescription,
    status: s.status,
    dueAt: s.dueAt,
    workOrderCreatedAt: s.workOrderCreatedAt,
    responsibleEntity: {
      id: s.entityId, name: s.entityName, type: s.entityType,
      email: s.entityEmail, phone: s.entityPhone,
    },
    report: {
      id: s.reportId, title: s.reportTitle, description: s.reportDescription,
      status: s.reportStatus, priority: s.priority, address: s.address,
      latitude: s.latitude, longitude: s.longitude,
      categoryName: s.categoryName, subcategoryName: s.subcategoryName,
      reporterName: s.reporterName ?? null,
      photos,
    },
    generatedAt: new Date().toISOString(),
  };
}

function fmt(value) { return value == null ? '' : String(value); }

// Renders the snapshot to a PDF buffer. When pdfkit is unavailable, falls back to a plain
// UTF-8 text document so the work-order flow still works end-to-end (immutable + checksummed).
export async function renderDocument(snapshot) {
  if (PDFDocument) {
    const photos = await loadSnapshotPhotos(snapshot.report.photos);
    return new Promise((resolve, reject) => {
      try {
        const buffers = [];
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.on('data', (b) => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.fontSize(18).text('GradFix Work Order', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Work order: ${fmt(snapshot.workOrderTitle)}`);
        if (snapshot.workOrderDescription) doc.text(snapshot.workOrderDescription);
        doc.moveDown(0.5);
        doc.text(`Status: ${fmt(snapshot.status)}`);
        if (snapshot.dueAt) doc.text(`Due: ${fmt(snapshot.dueAt)}`);
        doc.moveDown(0.5);
        doc.fontSize(14).text('Responsible entity');
        doc.fontSize(12)
          .text(`Name: ${fmt(snapshot.responsibleEntity.name)}`)
          .text(`Type: ${fmt(snapshot.responsibleEntity.type)}`);
        if (snapshot.responsibleEntity.phone) doc.text(`Phone: ${fmt(snapshot.responsibleEntity.phone)}`);
        doc.moveDown(0.5);
        doc.fontSize(14).text('Report');
        doc.fontSize(12)
          .text(`Title: ${fmt(snapshot.report.title)}`)
          .text(`Category: ${fmt(snapshot.report.categoryName)}${snapshot.report.subcategoryName ? ' / ' + snapshot.report.subcategoryName : ''}`)
          .text(`Priority: ${fmt(snapshot.report.priority)}`)
          .text(`Status: ${fmt(snapshot.report.status)}`);
        if (snapshot.report.address) doc.text(`Address: ${fmt(snapshot.report.address)}`);
        if (snapshot.report.latitude != null && snapshot.report.longitude != null) {
          doc.text(`Location: ${snapshot.report.latitude}, ${snapshot.report.longitude}`);
        }
        if (snapshot.report.reporterName) doc.text(`Reporter: ${fmt(snapshot.report.reporterName)}`);
        doc.moveDown(0.5);
        if (snapshot.report.description) {
          doc.text('Description:').text(snapshot.report.description);
        }
        if (photos.length) {
          doc.moveDown(0.5);
          doc.fontSize(14).text('Photos');
          for (const [i, photo] of photos.entries()) {
            doc.moveDown(0.25);
            doc.fontSize(10).text(`Photo ${i + 1}`);
            doc.image(photo.data, { fit: [240, 160], align: 'left' });
          }
        }
        doc.end();
      } catch (err) { reject(err); }
    });
  }
  // Fallback text document.
  const lines = [
    'GRADFIX WORK ORDER',
    `Work order: ${fmt(snapshot.workOrderTitle)}`,
    snapshot.workOrderDescription ?? '',
    `Status: ${fmt(snapshot.status)}`,
    snapshot.dueAt ? `Due: ${fmt(snapshot.dueAt)}` : '',
    '',
    'Responsible entity:',
    `  Name: ${fmt(snapshot.responsibleEntity.name)}`,
    `  Type: ${fmt(snapshot.responsibleEntity.type)}`,
    snapshot.responsibleEntity.phone ? `  Phone: ${fmt(snapshot.responsibleEntity.phone)}` : '',
    '',
    'Report:',
    `  Title: ${fmt(snapshot.report.title)}`,
    `  Category: ${fmt(snapshot.report.categoryName)}${snapshot.report.subcategoryName ? ' / ' + snapshot.report.subcategoryName : ''}`,
    `  Priority: ${fmt(snapshot.report.priority)}`,
    `  Status: ${fmt(snapshot.report.status)}`,
    snapshot.report.address ? `  Address: ${fmt(snapshot.report.address)}` : '',
    (snapshot.report.latitude != null && snapshot.report.longitude != null)
      ? `  Location: ${snapshot.report.latitude}, ${snapshot.report.longitude}` : '',
    snapshot.report.reporterName ? `  Reporter: ${fmt(snapshot.report.reporterName)}` : '',
    snapshot.report.description ? `\nDescription:\n${snapshot.report.description}` : '',
    snapshot.report.photos?.length ? `\nPhotos:\n${snapshot.report.photos.map((p, i) => `  ${i + 1}. ${p.url || p.storageKey}`).join('\n')}` : '',
  ].filter((l) => l !== '');
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function loadSnapshotPhotos(photos = []) {
  const loaded = [];
  for (const photo of photos) {
    if (!photo.storageKey) continue;
    try {
      loaded.push({ ...photo, data: await readDocumentFile(photo.storageKey) });
    } catch {
      // A missing upload should not block issuing the work order document.
    }
  }
  return loaded;
}

async function nextVersion(client, tenantId, workOrderId) {
  const run = client ?? { query };
  const { rows } = await run.query(
    'SELECT count(*)::int + 1 AS v FROM work_order_documents WHERE tenant_id = $1 AND work_order_id = $2',
    [tenantId, workOrderId],
  );
  return rows[0].v;
}

// Generates (or regenerates) an immutable PDF document version, stores it on disk, and inserts
// the document row. `client` lets this run inside an open transaction. When `regenerate` is true
// a new version is always produced (per gist: regenerating after send creates a new version);
// otherwise the latest version is returned if one already exists.
export async function persistDocument(client, tenantId, workOrderId, userId, { regenerate = false } = {}) {
  const run = client ?? { query };
  if (!regenerate) {
    const { rows: existing } = await run.query(
      `SELECT id, version, storage_key AS "storageKey", url, checksum, generated_at AS "generatedAt",
              snapshot
       FROM work_order_documents
       WHERE tenant_id = $1 AND work_order_id = $2
       ORDER BY version DESC LIMIT 1`,
      [tenantId, workOrderId],
    );
    if (existing[0]) return existing[0];
  }

  const snapshot = await buildSnapshot(run, tenantId, workOrderId);
  const buffer = await renderDocument(snapshot);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const version = await nextVersion(run, tenantId, workOrderId);
  const fileName = `v${version}-${crypto.randomUUID()}.${PDFDocument ? 'pdf' : 'txt'}`;
  const storageKey = `${tenantId}/work-orders/${workOrderId}/${fileName}`;
  await mkdir(path.resolve(env.uploadDir, tenantId, 'work-orders', workOrderId), { recursive: true });
  await writeFile(path.resolve(env.uploadDir, storageKey), buffer);

  const { rows } = await run.query(
    `INSERT INTO work_order_documents (tenant_id, work_order_id, version, storage_key, url, checksum, snapshot, generated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING id, version, storage_key AS "storageKey", url, checksum,
               generated_by AS "generatedBy", generated_at AS "generatedAt", snapshot`,
    [tenantId, workOrderId, version, storageKey, `/uploads/${storageKey}`, checksum,
     JSON.stringify(snapshot), userId],
  );
  return rows[0];
}

export async function getCurrentDocument(tenantId, workOrderId) {
  const { rows } = await query(
    `SELECT id, version, storage_key AS "storageKey", url, checksum, generated_at AS "generatedAt", snapshot
     FROM work_order_documents
     WHERE tenant_id = $1 AND work_order_id = $2
     ORDER BY version DESC LIMIT 1`,
    [tenantId, workOrderId],
  );
  return rows[0] ?? null;
}

export async function readDocumentFile(storageKey) {
  return readFile(path.resolve(env.uploadDir, storageKey));
}

export function documentFileName(doc) {
  const ext = (doc.storageKey || '').split('.').pop() || 'pdf';
  return `work-order-v${doc.version}.${ext}`;
}
