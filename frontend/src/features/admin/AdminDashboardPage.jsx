import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { STATUS_LABELS } from '../../lib/reportStatus.js';
import StatusPill from '../../components/StatusPill.jsx';
import Spinner from '../../components/Spinner.jsx';

const OPEN_STATUSES = new Set(['new', 'accepted', 'assigned', 'in_progress']);
const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ageDays = (s) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000));

export default function AdminDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats });
  const assignedQuery = useQuery({
    queryKey: ['admin-dashboard-assigned'],
    queryFn: () => adminApi.listReports({ status: 'assigned', limit: 5 }),
  });
  const recentQuery = useQuery({
    queryKey: ['admin-dashboard-recent'],
    queryFn: () => adminApi.listReports({ sort: 'recent', limit: 5 }),
  });
  const openQuery = useQuery({
    queryKey: ['admin-dashboard-open'],
    queryFn: () => adminApi.listReports({ sort: 'recent', limit: 100 }),
  });

  if (statsQuery.isLoading) return <Spinner />;
  if (statsQuery.isError) return <div className="alert alert-error">Could not load the admin dashboard.</div>;

  const stats = statsQuery.data;
  const statusCounts = Object.fromEntries((stats.byStatus || []).map((s) => [s.status, s.count]));
  const overdue = (openQuery.data?.items || [])
    .filter((r) => OPEN_STATUSES.has(r.status) && ageDays(r.createdAt) >= 7)
    .slice(0, 5);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Admin dashboard</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Operational overview for city staff.</p>
        </div>
        <Link className="btn btn-primary btn-sm" to="/admin/reports">Open report queue</Link>
      </div>

      <div className="admin-kpi-grid">
        <Kpi label="Total reports" value={stats.total} />
        <Kpi label="New" value={statusCounts.new || 0} />
        <Kpi label="Assigned" value={statusCounts.assigned || 0} />
        <Kpi label="In progress" value={statusCounts.in_progress || 0} />
      </div>

      <section className="card stack">
        <h2>Reports by status</h2>
        <div className="admin-status-grid">
          {['new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed'].map((status) => (
            <div key={status} className="admin-status-card">
              <StatusPill status={status} />
              <strong>{statusCounts[status] || 0}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card stack" style={{ flex: '1 1 320px' }}>
          <h2>Assigned reports</h2>
          <ReportList query={assignedQuery} empty="No assigned reports." />
        </section>

        <section className="card stack" style={{ flex: '1 1 320px' }}>
          <h2>Overdue items</h2>
          {openQuery.isLoading && <Spinner />}
          {openQuery.isError && <div className="alert alert-error">Could not load overdue items.</div>}
          {openQuery.data && overdue.length === 0 && <p className="muted" style={{ margin: 0 }}>No open reports older than 7 days.</p>}
          {overdue.length > 0 && <ReportRows items={overdue} showAge />}
        </section>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card stack" style={{ flex: '1 1 320px' }}>
          <h2>Responsible entity workload</h2>
          {stats.mostBurdenedEntities?.length ? (
            <div className="report-list">
              {stats.mostBurdenedEntities.map((e) => (
                <div key={e.entityId} className="report-item">
                  <span>{e.name}</span>
                  <strong>{e.count}</strong>
                </div>
              ))}
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>No responsible entities configured.</p>}
        </section>

        <section className="card stack" style={{ flex: '1 1 320px' }}>
          <h2>Recent activity</h2>
          <ReportList query={recentQuery} empty="No recent reports." />
        </section>
      </div>

      <section className="card stack">
        <h2>Shortcuts</h2>
        <div className="row">
          <Link className="btn btn-sm" to="/admin/reports?status=new">Review new reports</Link>
          <Link className="btn btn-sm" to="/admin/reports?status=assigned">Track assigned reports</Link>
          <Link className="btn btn-sm" to="/admin/reports">Search reports</Link>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card stat-card">
      <div className="stat-value">{value ?? 0}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ReportList({ query, empty }) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <div className="alert alert-error">Could not load reports.</div>;
  if (!query.data?.items.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  return <ReportRows items={query.data.items} />;
}

function ReportRows({ items, showAge = false }) {
  return (
    <div className="report-list">
      {items.map((r) => (
        <Link key={r.id} to={`/admin/reports/${r.id}`} className="report-item">
          <span>
            <strong>{r.title}</strong>
            <span className="report-meta" style={{ display: 'block' }}>
              {STATUS_LABELS[r.status] || r.status} · {fmtDate(r.createdAt)}{showAge ? ` · ${ageDays(r.createdAt)}d old` : ''}
            </span>
          </span>
          <StatusPill status={r.status} />
        </Link>
      ))}
    </div>
  );
}
