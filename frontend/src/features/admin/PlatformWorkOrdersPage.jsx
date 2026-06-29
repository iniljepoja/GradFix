import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { WorkOrderPill } from './WorkOrdersPage.jsx';
import Spinner from '../../components/Spinner.jsx';

const fmt = (s) => s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function PlatformWorkOrdersPage() {
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const params = { page, limit: 50, ...(tenantId ? { tenantId } : {}) };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-work-orders', params],
    queryFn: () => adminApi.listPlatformWorkOrders(params),
    placeholderData: keepPreviousData,
  });
  const meta = data?.meta;

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>All Work Orders</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Cross-tenant work order overview. Read-only.</p>
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
        {isError && <div className="alert alert-error">Could not load work orders.</div>}
        {data && data.items.length === 0 && <p className="muted" style={{ margin: 0 }}>No work orders.</p>}
        {data && data.items.length > 0 && (
          <table className="admin-table no-click">
            <thead>
              <tr><th>Work order</th><th>Status</th><th>Report</th><th>Tenant</th><th>Created</th></tr>
            </thead>
            <tbody>
              {data.items.map((wo) => (
                <tr key={wo.id}>
                  <td>{wo.title}</td>
                  <td><WorkOrderPill status={wo.status} /></td>
                  <td>{wo.reportTitle}</td>
                  <td>{wo.tenantName}</td>
                  <td className="muted">{fmt(wo.createdAt)}</td>
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
