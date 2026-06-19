import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import * as categoriesApi from '../../api/categories.js';
import { STATUS_LABELS, PRIORITIES } from '../../lib/reportStatus.js';
import StatusPill from '../../components/StatusPill.jsx';
import PriorityPill from '../../components/PriorityPill.jsx';
import Spinner from '../../components/Spinner.jsx';

const STATUSES = ['new', 'accepted', 'assigned', 'in_progress', 'resolved', 'closed'];
const ageDays = (s) => `${Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000))}d`;

export default function ReportsQueuePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: '', priority: '', categoryId: '', assignedEntityId: '', q: '', sort: 'recent', page: 1,
  });
  const [search, setSearch] = useState('');

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));

  // Strip empty params so they aren't sent as blank query values.
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-reports', filters],
    queryFn: () => adminApi.listReports(params),
    placeholderData: keepPreviousData,
  });

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const entitiesQuery = useQuery({ queryKey: ['admin-entities'], queryFn: adminApi.listEntities });

  const meta = data?.meta;

  return (
    <div className="stack">
      <h1>Reports</h1>

      <form
        className="admin-filters card"
        onSubmit={(e) => { e.preventDefault(); setFilters((f) => ({ ...f, q: search, page: 1 })); }}
      >
        <input className="input" placeholder="Search title/description…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={filters.status} onChange={set('status')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="input" value={filters.priority} onChange={set('priority')}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select className="input" value={filters.categoryId} onChange={set('categoryId')}>
          <option value="">All categories</option>
          {categoriesQuery.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filters.assignedEntityId} onChange={set('assignedEntityId')}>
          <option value="">Any assignee</option>
          {entitiesQuery.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="input" value={filters.sort} onChange={set('sort')}>
          <option value="recent">Most recent</option>
          <option value="top">Most affected</option>
          <option value="priority">Highest priority</option>
        </select>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
      </form>

      <div className="card">
        {isLoading && <Spinner />}
        {isError && <div className="alert alert-error">Could not load reports.</div>}
        {data && data.items.length === 0 && <p className="muted" style={{ margin: 0 }}>No reports match these filters.</p>}
        {data && data.items.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th>
                <th>Affected</th><th>Age</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/admin/reports/${r.id}`)}>
                  <td>{r.title}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td><PriorityPill priority={r.priority} /></td>
                  <td>{r.assignedEntityName || <span className="muted">—</span>}</td>
                  <td>👥 {r.upvoteCount}</td>
                  <td className="muted">{ageDays(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm" disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>‹ Prev</button>
          <span className="report-meta">Page {meta.page} of {meta.totalPages} · {meta.total} total</span>
          <button className="btn btn-sm" disabled={filters.page >= meta.totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>Next ›</button>
        </div>
      )}
    </div>
  );
}
