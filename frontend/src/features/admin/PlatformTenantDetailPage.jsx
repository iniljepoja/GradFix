import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Spinner from '../../components/Spinner.jsx';

const nullableNumber = (value) => value === '' || value == null ? null : Number(value);
const fmt = (s) => s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const mapUrl = (tenant) => tenant.centerLat == null || tenant.centerLng == null
  ? null
  : `/?lat=${tenant.centerLat}&lng=${tenant.centerLng}&zoom=13&label=${encodeURIComponent(tenant.name)}`;

export default function PlatformTenantDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [editForm, setEditForm] = useState(null);
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const statsQ = useQuery({ queryKey: ['platform-tenant-stats', id], queryFn: () => adminApi.getPlatformTenantStats(id) });
  const updateM = useMutation({
    mutationFn: (body) => adminApi.updatePlatformTenant(id, body),
    onSuccess: () => {
      setEditForm(null);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-stats', id] });
    },
  });
  const tenant = tenantsQ.data?.find((t) => t.id === id);

  if (tenantsQ.isLoading) return <Spinner />;
  if (!tenant) return <div className="alert alert-error">Tenant not found.</div>;

  const startEdit = () => setEditForm({ name: tenant.name || '', centerLat: tenant.centerLat ?? '', centerLng: tenant.centerLng ?? '' });
  const save = (e) => {
    e.preventDefault();
    updateM.mutate({ name: editForm.name.trim(), centerLat: nullableNumber(editForm.centerLat), centerLng: nullableNumber(editForm.centerLng) });
  };

  return (
    <div className="stack">
      <Link className="btn btn-ghost btn-sm" to="/admin/platform/tenants">‹ Back to tenants</Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 style={{ margin: 0 }}>{tenant.name}</h1><p className="muted" style={{ margin: '4px 0 0' }}>{tenant.slug}</p></div>
        <span className="row">
          {mapUrl(tenant) && <Link className="btn btn-sm" to={mapUrl(tenant)}>View on Map</Link>}
          <button className="btn btn-sm" disabled={updateM.isPending} onClick={() => updateM.mutate({ isActive: !tenant.isActive })}>{tenant.isActive ? 'Suspend tenant' : 'Activate tenant'}</button>
        </span>
      </div>
      <div className="alert alert-info">
        {tenant.isActive
          ? 'Suspending this tenant blocks city users and public tenant routes, but keeps all data for later reactivation.'
          : 'This tenant is suspended. Activate it to restore city access to users, reports, and work orders.'}
      </div>

      <div className="row">
        <Kpi label="Reports" value={statsQ.data?.reports.total ?? '—'} />
        <Kpi label="Open" value={statsQ.data?.reports.open ?? '—'} />
        <Kpi label="Resolved/closed" value={statsQ.data?.reports.resolved ?? '—'} />
        <Kpi label="Work orders" value={statsQ.data?.workOrders.total ?? '—'} />
        <Kpi label="Users" value={statsQ.data?.users.total ?? '—'} />
      </div>
      {statsQ.isError && <div className="alert alert-error">Could not load tenant statistics.</div>}

      <section className="card stack">
        <h2>Details</h2>
        <div className="report-list">
          <div className="report-item"><span>Status</span><strong>{tenant.isActive ? 'Active' : 'Suspended'}</strong></div>
          <div className="report-item"><span>Map center</span><strong>{tenant.centerLat ?? '—'}, {tenant.centerLng ?? '—'}</strong></div>
          <div className="report-item"><span>Created</span><strong>{fmt(tenant.createdAt)}</strong></div>
          <div className="report-item"><span>Responsible entities</span><strong>{statsQ.data ? `${statsQ.data.responsibleEntities.active}/${statsQ.data.responsibleEntities.total} active` : '—'}</strong></div>
          <div className="report-item"><span>Tenant admins</span><strong>{statsQ.data?.users.tenant_admins ?? '—'}</strong></div>
        </div>
      </section>

      <section className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}><h2>Configuration</h2>{!editForm && <button className="btn btn-sm" onClick={startEdit}>Edit</button>}</div>
        {!editForm && <p className="muted" style={{ margin: 0 }}>Name and map center are editable.</p>}
        {editForm && (
          <form className="stack" onSubmit={save}>
            <div className="row">
              <input className="input" style={{ maxWidth: 260 }} placeholder="City name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="input" style={{ maxWidth: 160 }} placeholder="Center latitude" type="number" step="any" value={editForm.centerLat} onChange={(e) => setEditForm((f) => ({ ...f, centerLat: e.target.value }))} />
              <input className="input" style={{ maxWidth: 160 }} placeholder="Center longitude" type="number" step="any" value={editForm.centerLng} onChange={(e) => setEditForm((f) => ({ ...f, centerLng: e.target.value }))} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-sm" onClick={() => setEditForm(null)}>Cancel</button><button className="btn btn-primary btn-sm" disabled={!editForm.name.trim() || updateM.isPending}>Save</button></div>
          </form>
        )}
        {updateM.isError && <div className="alert alert-error">{apiErrorMessage(updateM.error)}</div>}
      </section>
    </div>
  );
}

function Kpi({ label, value }) {
  return <div className="card stat-card" style={{ flex: '1 1 140px' }}><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}
