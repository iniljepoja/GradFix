import { query } from '../config/db.js';

const RESOLVED_STATES = ['resolved', 'closed'];

// Public dashboard statistics — no auth, tenant-scoped. Safe aggregate counts only.
export async function publicStats(tenantId) {
  const [{ rows: totalRows }, { rows: byStatus }, { rows: byCategory }] = await Promise.all([
    query('SELECT count(*)::int AS total FROM reports WHERE tenant_id = $1', [tenantId]),
    query(`SELECT status, count(*)::int AS count FROM reports WHERE tenant_id = $1
           GROUP BY status`, [tenantId]),
    query(`SELECT c.id AS "categoryId", c.name, c.slug, count(r.id)::int AS count
           FROM categories c
           LEFT JOIN reports r ON r.category_id = c.id AND r.tenant_id = c.tenant_id
           WHERE c.tenant_id = $1 AND c.is_active = TRUE
           GROUP BY c.id, c.name, c.slug ORDER BY c.sort_order`, [tenantId]),
  ]);

  const total = totalRows[0].total;
  const resolved = byStatus.filter((s) => RESOLVED_STATES.includes(s.status))
    .reduce((n, s) => n + s.count, 0);

  return {
    total,
    resolvedPct: total ? Math.round((resolved / total) * 1000) / 10 : 0,
    byStatus,
    byCategory,
  };
}

// Richer breakdown for the admin dashboard (staff only).
export async function adminStats(tenantId) {
  const base = await publicStats(tenantId);
  const [{ rows: byPriority }, { rows: avgRows }, { rows: byEntity }, { rows: topReporters },
    { rows: ratingRows }] = await Promise.all([
    query(`SELECT priority, count(*)::int AS count FROM reports WHERE tenant_id = $1
           GROUP BY priority`, [tenantId]),
    query(`SELECT avg(extract(epoch FROM (resolved_at - created_at)) / 3600.0) AS hours
           FROM reports WHERE tenant_id = $1 AND resolved_at IS NOT NULL`, [tenantId]),
    query(`SELECT e.id AS "entityId", e.name, count(r.id)::int AS count
           FROM responsible_entities e
           LEFT JOIN reports r ON r.assigned_entity_id = e.id
           WHERE e.tenant_id = $1
           GROUP BY e.id, e.name ORDER BY count DESC LIMIT 10`, [tenantId]),
    query(`SELECT r.reporter_id AS "reporterId", u.full_name AS "fullName", count(*)::int AS count
           FROM reports r JOIN users u ON u.id = r.reporter_id
           WHERE r.tenant_id = $1
           GROUP BY r.reporter_id, u.full_name ORDER BY count DESC LIMIT 10`, [tenantId]),
    query(`SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE satisfied)::int AS satisfied
           FROM report_ratings rt JOIN reports r ON r.id = rt.report_id
           WHERE r.tenant_id = $1`, [tenantId]),
  ]);

  const ratings = ratingRows[0];
  return {
    ...base,
    byPriority,
    avgResolutionHours: avgRows[0].hours ? Math.round(avgRows[0].hours * 10) / 10 : null,
    mostBurdenedEntities: byEntity,
    activeReporters: topReporters,
    satisfaction: {
      rated: ratings.total,
      satisfiedPct: ratings.total ? Math.round((ratings.satisfied / ratings.total) * 1000) / 10 : null,
    },
  };
}
