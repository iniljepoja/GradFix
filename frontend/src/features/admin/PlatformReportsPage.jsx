import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import StatusPill from '../../components/StatusPill.jsx';
import PriorityPill from '../../components/PriorityPill.jsx';
import Spinner from '../../components/Spinner.jsx';

const ageDays = (s) => `${Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000))}d`;

export default function PlatformReportsPage() {
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const params = { page, limit: 50, ...(tenantId ? { tenantId } : {}) };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-reports', params],
    queryFn: () => adminApi.listPlatformReports(params),
    placeholderData: keepPreviousData,
  });
  const meta = data?.meta;

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>All Reports</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Cross-tenant report overview. Read-only.</p>
      </div>

      <form className="admin-filters card" onSubmit={(e) => e.preventDefault()}>
        <select className="input" value={tenantId}
          onChange={(e) => { setTenantId(e.target.value); setPage(1); }}>
          <option value="">All tenants</option>
          {tenantsQ.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </form>

      <div className="card">
        {isLoading && <Spinner />}
        {isError && <div className="alert alert-error">Could not load reports.</div>}
        {data && data.items.length === 0 && <p className="muted" style={{ margin: 0 }}>No reports.</p>}
        {data && data.items.length > 0 && (
          <table className="admin-table no-click">
            <thead>
              <tr><th>Title</th><th>Status</th><th>Priority</th><th>Tenant</th><th>Age</th></tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td><PriorityPill priority={r.priority} /></td>
                  <td>{r.tenantName}</td>
                  <td className="muted">{ageDays(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="row" style={{ justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          <span className="report-meta">Page {meta.page} of {meta.totalPages} · {meta.total} total</span>
          <button className="btn btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
        </div>
      )}
    </div>
  );
}
