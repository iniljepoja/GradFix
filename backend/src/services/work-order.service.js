import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { sendMail } from '../utils/mailer.js';
import {
  persistDocument, getCurrentDocument, readDocumentFile, documentFileName,
} from './work-order-document.service.js';

export const WORK_ORDER_STATUSES = [
  'draft', 'sent', 'delivery_failed', 'in_progress', 'completed', 'cancelled', 'superseded',
];

export const WORK_ORDER_TRANSITIONS = {
  draft: ['sent', 'delivery_failed', 'cancelled'],
  sent: ['in_progress', 'delivery_failed', 'cancelled', 'superseded'],
  delivery_failed: ['sent', 'cancelled'],
  in_progress: ['completed', 'cancelled', 'superseded'],
  completed: [],
  cancelled: [],
  superseded: [],
};

// Statuses from which a work order may be sent (initial send from draft, retry from
// delivery_failed). Sending is the operational path that produces a PDF + email delivery.
export const SENDABLE_STATUSES = ['draft', 'delivery_failed'];

export function assertCanSendWorkOrder(status) {
  if (!SENDABLE_STATUSES.includes(status)) {
    throw ApiError.badRequest(`Work order cannot be sent from "${status}"`);
  }
}

const ACTIVE_STATUSES = ['draft', 'sent', 'delivery_failed', 'in_progress'];

export function shouldResolveReportAfterCompletion(reportStatus, activeWorkOrderCount) {
  return reportStatus === 'in_progress' && activeWorkOrderCount === 0;
}

export function assertWorkOrderTransition(from, to, note) {
  if (from === to) throw ApiError.badRequest(`Work order is already "${to}"`);
  if (!WORK_ORDER_TRANSITIONS[from]?.includes(to)) {
    throw ApiError.badRequest(`Illegal work order transition: ${from} -> ${to}`);
  }
  if (to === 'cancelled' && !note?.trim()) {
    throw ApiError.badRequest('Cancellation reason is required');
  }
}

const SELECT_WORK_ORDER = `
  SELECT wo.id, wo.report_id AS "reportId", wo.responsible_entity_id AS "responsibleEntityId",
         e.name AS "responsibleEntityName", wo.created_by AS "createdBy",
         wo.title, wo.description, wo.status, wo.due_at AS "dueAt",
         wo.sent_at AS "sentAt", wo.completed_at AS "completedAt", wo.cancelled_at AS "cancelledAt",
         wo.superseded_by_id AS "supersededById", wo.created_at AS "createdAt", wo.updated_at AS "updatedAt"
  FROM work_orders wo
  JOIN responsible_entities e ON e.id = wo.responsible_entity_id
`;

export async function list(tenantId, f = {}) {
  const where = ['wo.tenant_id = $1'];
  const params = [tenantId];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };

  if (f.status) add('wo.status = ?', f.status);
  if (f.reportId) add('wo.report_id = ?', f.reportId);
  if (f.assignedEntityId) add('wo.responsible_entity_id = ?', f.assignedEntityId);

  const limit = f.limit ?? 50;
  const page = f.page ?? 1;
  const offset = (page - 1) * limit;
  const whereSql = where.join(' AND ');

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM work_orders wo WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT wo.id, wo.report_id AS "reportId", r.title AS "reportTitle",
            wo.responsible_entity_id AS "responsibleEntityId", e.name AS "responsibleEntityName",
            wo.title, wo.status, wo.due_at AS "dueAt", wo.sent_at AS "sentAt",
            wo.completed_at AS "completedAt", wo.created_at AS "createdAt", wo.updated_at AS "updatedAt"
     FROM work_orders wo
     JOIN reports r ON r.id = wo.report_id AND r.tenant_id = wo.tenant_id
     JOIN responsible_entities e ON e.id = wo.responsible_entity_id AND e.tenant_id = wo.tenant_id
     WHERE ${whereSql}
     ORDER BY wo.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: countRows[0].total, page, limit };
}

export async function listForReport(tenantId, reportId) {
  await assertReportInTenant(tenantId, reportId);
  const { rows } = await query(
    `${SELECT_WORK_ORDER}
     WHERE wo.tenant_id = $1 AND wo.report_id = $2
     ORDER BY wo.created_at DESC`,
    [tenantId, reportId],
  );
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const { rows: events } = await query(
    `SELECT id, work_order_id AS "workOrderId", event_type AS "eventType",
            from_status AS "fromStatus", to_status AS "toStatus", note, created_at AS "createdAt"
     FROM work_order_events
     WHERE tenant_id = $1 AND work_order_id = ANY($2::uuid[])
     ORDER BY created_at`,
    [tenantId, ids],
  );
  return rows.map((row) => ({ ...row, events: events.filter((e) => e.workOrderId === row.id) }));
}

export async function getById(tenantId, workOrderId) {
  const { rows } = await query(
    `${SELECT_WORK_ORDER}
     WHERE wo.tenant_id = $1 AND wo.id = $2`,
    [tenantId, workOrderId],
  );
  if (!rows[0]) throw ApiError.notFound('Work order not found');

  const [{ rows: documents }, { rows: deliveries }, { rows: events }] = await Promise.all([
    query(`SELECT id, version, storage_key AS "storageKey", url, checksum,
                  generated_by AS "generatedBy", generated_at AS "generatedAt"
           FROM work_order_documents
           WHERE tenant_id = $1 AND work_order_id = $2
           ORDER BY version DESC`, [tenantId, workOrderId]),
    query(`SELECT id, document_id AS "documentId", channel, recipient_email AS "recipientEmail",
                  status, attempt_count AS "attemptCount", last_error AS "lastError",
                  queued_at AS "queuedAt", sent_at AS "sentAt", failed_at AS "failedAt", created_at AS "createdAt"
           FROM work_order_deliveries
           WHERE tenant_id = $1 AND work_order_id = $2
           ORDER BY created_at DESC`, [tenantId, workOrderId]),
    query(`SELECT id, actor_id AS "actorId", event_type AS "eventType",
                  from_status AS "fromStatus", to_status AS "toStatus", note, metadata,
                  created_at AS "createdAt"
           FROM work_order_events
           WHERE tenant_id = $1 AND work_order_id = $2
           ORDER BY created_at`, [tenantId, workOrderId]),
  ]);

  return { ...rows[0], documents, deliveries, events };
}

export async function createWorkOrder(tenantId, reportId, userId, body) {
  return withTransaction(async (c) => {
    const report = await loadReportForWorkOrder(c, tenantId, reportId);
    if (report.status === 'new') throw ApiError.badRequest('Accept the report before creating a work order');
    if (['resolved', 'closed'].includes(report.status)) {
      throw ApiError.badRequest(`Cannot create a work order for a ${report.status} report`);
    }

    const entityId = await resolveEntity(c, tenantId, body.entityId, report);
    const { rows: existing } = await c.query(
      `SELECT id FROM work_orders
       WHERE tenant_id = $1 AND report_id = $2 AND responsible_entity_id = $3
         AND status = ANY($4::work_order_status[])
       LIMIT 1`,
      [tenantId, reportId, entityId, ACTIVE_STATUSES],
    );
    if (existing[0]) {
      throw ApiError.conflict('An active work order already exists for this report and entity');
    }

    const title = body.title?.trim() || `Work order for: ${report.title}`;
    const description = body.description?.trim() || report.description || null;

    const { rows } = await c.query(
      `INSERT INTO work_orders
         (tenant_id, report_id, responsible_entity_id, created_by, title, description, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, report_id AS "reportId", responsible_entity_id AS "responsibleEntityId",
                 title, description, status, due_at AS "dueAt", created_at AS "createdAt"`,
      [tenantId, reportId, entityId, userId, title, description, body.dueAt ?? null],
    );
    const workOrder = rows[0];
    await insertEvent(c, tenantId, workOrder.id, userId, 'work_order.created', null, 'draft', null, {
      reportId,
      responsibleEntityId: entityId,
    });

    if (report.status === 'accepted') {
      await c.query(
        'UPDATE reports SET status = $1, assigned_entity_id = $2 WHERE id = $3',
        ['assigned', entityId, reportId],
      );
      await c.query(
        `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
         VALUES ($1, $2, 'accepted', 'assigned', 'Work order created')`,
        [reportId, userId],
      );
    }

    return workOrder;
  });
}

export async function changeWorkOrderStatus(tenantId, workOrderId, userId, { toStatus, note }) {
  // `sent` is achieved through the operational send path (PDF + email delivery), not a bare
  // status flip. Delegate so the API stays consistent regardless of which route a caller uses.
  if (toStatus === 'sent') return sendWorkOrder(tenantId, workOrderId, userId, {});
  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `SELECT id, report_id, status FROM work_orders
       WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [workOrderId, tenantId],
    );
    if (!rows[0]) throw ApiError.notFound('Work order not found');
    const workOrder = rows[0];
    assertWorkOrderTransition(workOrder.status, toStatus, note);

    const sentAt = toStatus === 'sent' ? 'now()' : 'sent_at';
    const completedAt = toStatus === 'completed' ? 'now()' : 'completed_at';
    const cancelledAt = toStatus === 'cancelled' ? 'now()' : 'cancelled_at';
    await c.query(
      `UPDATE work_orders
       SET status = $1, sent_at = ${sentAt}, completed_at = ${completedAt}, cancelled_at = ${cancelledAt}
       WHERE id = $2`,
      [toStatus, workOrderId],
    );
    await insertEvent(c, tenantId, workOrderId, userId, 'work_order.status_changed', workOrder.status, toStatus, note);

    if (toStatus === 'in_progress') {
      await moveReportInProgress(c, tenantId, workOrder.report_id, userId);
    }
    if (toStatus === 'completed') {
      await resolveReportIfWorkComplete(c, tenantId, workOrder.report_id, userId);
    }

    return { id: workOrderId, fromStatus: workOrder.status, status: toStatus };
  });
}

async function assertReportInTenant(tenantId, reportId) {
  const { rows } = await query('SELECT 1 FROM reports WHERE id = $1 AND tenant_id = $2', [reportId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Report not found');
}

async function loadReportForWorkOrder(c, tenantId, reportId) {
  const { rows } = await c.query(
    `SELECT r.id, r.title, r.description, r.status, r.category_id, r.assigned_entity_id
     FROM reports r
     WHERE r.id = $1 AND r.tenant_id = $2 FOR UPDATE`,
    [reportId, tenantId],
  );
  if (!rows[0]) throw ApiError.notFound('Report not found');
  return rows[0];
}

async function resolveEntity(c, tenantId, requestedEntityId, report) {
  let entityId = requestedEntityId || report.assigned_entity_id;
  if (!entityId) {
    const { rows } = await c.query(
      'SELECT responsible_entity_id AS id FROM category_routes WHERE category_id = $1',
      [report.category_id],
    );
    entityId = rows[0]?.id;
  }
  if (!entityId) throw ApiError.badRequest('No entity provided and no route configured for the category');

  const { rows } = await c.query(
    'SELECT id FROM responsible_entities WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE',
    [entityId, tenantId],
  );
  if (!rows[0]) throw ApiError.badRequest('Unknown responsible entity for this tenant');
  return entityId;
}

async function insertEvent(c, tenantId, workOrderId, actorId, eventType, fromStatus, toStatus, note, metadata = {}) {
  await c.query(
    `INSERT INTO work_order_events
       (tenant_id, work_order_id, actor_id, event_type, from_status, to_status, note, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [tenantId, workOrderId, actorId, eventType, fromStatus, toStatus, note ?? null, JSON.stringify(metadata)],
  );
}

async function moveReportInProgress(c, tenantId, reportId, userId) {
  const { rows } = await c.query(
    'SELECT status FROM reports WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
    [reportId, tenantId],
  );
  if (!rows[0] || !['accepted', 'assigned'].includes(rows[0].status)) return;
  await c.query('UPDATE reports SET status = $1 WHERE id = $2', ['in_progress', reportId]);
  await c.query(
    `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
     VALUES ($1, $2, $3, 'in_progress', 'Work order started')`,
    [reportId, userId, rows[0].status],
  );
}

// ── PDF generation + email delivery ─────────────────────────────────────────
// The operational purpose of a work order: generate an immutable PDF snapshot and email it to
// the responsible entity. Email failure does NOT lose the work order — it becomes
// `delivery_failed` with a recorded delivery attempt and is retryable. Every attempt is audited.

export async function regenerateDocument(tenantId, workOrderId, userId) {
  return withTransaction(async (c) => {
    await lockWorkOrder(c, tenantId, workOrderId);
    const doc = await persistDocument(c, tenantId, workOrderId, userId, { regenerate: true });
    await insertEvent(c, tenantId, workOrderId, userId, 'work_order.pdf_regenerated',
      null, null, `Generated version ${doc.version}`);
    return doc;
  });
}

export async function sendWorkOrder(tenantId, workOrderId, userId, { regenerate = false } = {}) {
  // Stage 1 — generate/reuse the immutable document and queue a delivery. The work order keeps
  // its current status so a crash here never leaves a half-sent, unrecoverable record.
  const { workOrder, document: doc, deliveryId, recipientEmail } = await withTransaction(async (c) => {
    const wo = await lockWorkOrder(c, tenantId, workOrderId);
    assertCanSendWorkOrder(wo.status);

    const generated = await persistDocument(c, tenantId, workOrderId, userId, { regenerate });
    const fresher = !wo.lastDocumentId || generated.id !== wo.lastDocumentId;
    if (fresher) {
      await insertEvent(c, tenantId, workOrderId, userId, 'work_order.pdf_generated',
        null, null, `Generated version ${generated.version}`);
    }
    // The PDF body is an immutable snapshot, but the delivery recipient is operational metadata,
    // so resolve it fresh from the responsible entity (a retry picks up a corrected/added email).
    const { rows: entityRows } = await c.query(
      'SELECT email FROM responsible_entities WHERE id = $1 AND tenant_id = $2',
      [wo.responsible_entity_id ?? generated.snapshot?.responsibleEntity?.id, tenantId],
    );
    const recipient = entityRows[0]?.email ?? null;

    const { rows: deliveryRows } = await c.query(
      `INSERT INTO work_order_deliveries (tenant_id, work_order_id, document_id, channel, recipient_email, status)
       VALUES ($1, $2, $3, 'email', $4, 'queued')
       RETURNING id`,
      [tenantId, workOrderId, generated.id, recipient],
    );
    // A retry (issuing from delivery_failed) is audited as email_retried, per the Work Order
    // gist's audit-event list; an initial send from draft is email_queued.
    const queueEvent = wo.status === 'delivery_failed' ? 'work_order.email_retried' : 'work_order.email_queued';
    await insertEvent(c, tenantId, workOrderId, userId, queueEvent,
      null, null, recipient ? `Queued to ${recipient}` : 'Queued (no recipient email)');
    return { workOrder: wo, document: generated, deliveryId: deliveryRows[0].id, recipientEmail: recipient };
  });

  // Stage 2 — actually send the email, outside the transaction. A failure here is recoverable.
  const result = await deliverByEmail(workOrderId, doc, recipientEmail, workOrder.title);

  // Stage 3 — record the delivery result and transition the work order status + audit events.
  return withTransaction(async (c) => {
    const wo = await lockWorkOrder(c, tenantId, workOrderId);
    const toStatus = result.ok ? 'sent' : 'delivery_failed';
    const sameState = wo.status === toStatus; // retry that fails again — no status change

    if (!sameState) assertWorkOrderTransition(wo.status, toStatus, result.ok ? undefined : result.error);

    if (result.ok) {
      await c.query(
        `UPDATE work_order_deliveries SET status = 'sent', attempt_count = attempt_count + 1,
                 sent_at = now() WHERE id = $1`, [deliveryId]);
    } else {
      await c.query(
        `UPDATE work_order_deliveries SET status = 'failed', attempt_count = attempt_count + 1,
                 last_error = $2, failed_at = now() WHERE id = $1`,
        [deliveryId, result.error]);
    }

    if (!sameState) {
      await c.query(
        result.ok
          ? `UPDATE work_orders SET status = $1, sent_at = now() WHERE id = $2`
          : `UPDATE work_orders SET status = $1 WHERE id = $2`,
        [toStatus, workOrderId]);
    }

    await insertEvent(c, tenantId, workOrderId, userId,
      result.ok ? 'work_order.email_sent' : 'work_order.email_failed',
      sameState ? null : wo.status, sameState ? null : toStatus,
      result.ok ? `Sent to ${recipientEmail}` : result.error);
    if (!sameState) {
      await insertEvent(c, tenantId, workOrderId, userId, 'work_order.status_changed', wo.status, toStatus, 'Work order send');
    }
    return { id: workOrderId, fromStatus: wo.status, status: toStatus, documentId: doc.id, deliveryId };
  });
}

export async function downloadDocumentFile(tenantId, workOrderId) {
  await getById(tenantId, workOrderId);
  const doc = await getCurrentDocument(tenantId, workOrderId);
  if (!doc) throw ApiError.notFound('No document has been generated for this work order');
  const buffer = await readDocumentFile(doc.storageKey);
  return { buffer, fileName: documentFileName(doc), contentType: doc.storageKey.endsWith('.pdf') ? 'application/pdf' : 'text/plain' };
}

async function lockWorkOrder(c, tenantId, workOrderId) {
  const { rows } = await c.query(
    `SELECT wo.id, wo.report_id, wo.status, wo.title, wo.created_by, wo.responsible_entity_id,
            (SELECT max(version) FROM work_order_documents d WHERE d.work_order_id = wo.id) IS NOT NULL
              AS "hasDocument",
            (SELECT id FROM work_order_documents d WHERE d.work_order_id = wo.id
              ORDER BY version DESC LIMIT 1) AS "lastDocumentId"
     FROM work_orders wo WHERE wo.id = $1 AND wo.tenant_id = $2 FOR UPDATE`,
    [workOrderId, tenantId],
  );
  if (!rows[0]) throw ApiError.notFound('Work order not found');
  return rows[0];
}

async function deliverByEmail(workOrderId, document, recipientEmail, workOrderTitle) {
  if (!recipientEmail) {
    return { ok: false, error: 'Responsible entity has no email address configured' };
  }
  const subject = `GradFix work order: ${workOrderTitle}`;
  const text = `A work order has been issued to your organization.\n\nWork order: ${workOrderTitle}\nReference: ${workOrderId}\n\nThe full work order document is attached.`;
  const html = `<p>A work order has been issued to your organization.</p>` +
    `<p><strong>${escapeHtml(workOrderTitle)}</strong></p>` +
    `<p>Reference: ${workOrderId}</p><p>The full work order document is attached.</p>`;
  try {
    await sendMail({
      to: recipientEmail, subject, text, html,
      attachments: [{ filename: documentFileName(document), content: await readDocumentFile(document.storageKey) }],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function escapeHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function resolveReportIfWorkComplete(c, tenantId, reportId, userId) {
  const { rows: reportRows } = await c.query(
    'SELECT status FROM reports WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
    [reportId, tenantId],
  );
  if (!reportRows[0]) return;

  const { rows: activeRows } = await c.query(
    `SELECT count(*)::int AS count FROM work_orders
     WHERE tenant_id = $1 AND report_id = $2
       AND status IN ('draft', 'sent', 'delivery_failed', 'in_progress')`,
    [tenantId, reportId],
  );

  if (!shouldResolveReportAfterCompletion(reportRows[0].status, activeRows[0].count)) return;

  await c.query('UPDATE reports SET status = $1, resolved_at = now() WHERE id = $2', ['resolved', reportId]);
  await c.query(
    `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
     VALUES ($1, $2, 'in_progress', 'resolved', 'All active work orders completed')`,
    [reportId, userId],
  );
}
