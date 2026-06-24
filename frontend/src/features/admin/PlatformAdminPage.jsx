import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiErrorMessage } from '../../lib/apiError.js';
import { entityTypeLabel } from '../../lib/entities.js';
import Spinner from '../../components/Spinner.jsx';

export default function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tenantForm, setTenantForm] = useState({ name: '', slug: '' });
  const [adminForm, setAdminForm] = useState({ tenantId: '', email: '', password: '', fullName: '' });
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const reportsQ = useQuery({ queryKey: ['platform-reports'], queryFn: () => adminApi.listPlatformReports({ limit: 25 }) });
  const workOrdersQ = useQuery({ queryKey: ['platform-work-orders'], queryFn: () => adminApi.listPlatformWorkOrders({ limit: 25 }) });
  const entitiesQ = useQuery({ queryKey: ['platform-entities'], queryFn: adminApi.listPlatformEntities });
  const tenantAdminsQ = useQuery({ queryKey: ['platform-tenant-admins'], queryFn: adminApi.listPlatformTenantAdmins });

  const createTenantM = useMutation({
    mutationFn: adminApi.createPlatformTenant,
    onSuccess: () => { setTenantForm({ name: '', slug: '' }); queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }); },
  });
  const updateTenantM = useMutation({
    mutationFn: ({ id, body }) => adminApi.updatePlatformTenant(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });
  const createAdminM = useMutation({
    mutationFn: adminApi.createPlatformTenantAdmin,
    onSuccess: () => { setAdminForm({ tenantId: '', email: '', password: '', fullName: '' }); queryClient.invalidateQueries({ queryKey: ['platform-tenant-admins'] }); },
  });

  if (user?.role !== 'super_admin') return <div className="alert alert-error">Main Admin access required.</div>;
  if (tenantsQ.isLoading) return <Spinner />;

  return (
    <div className="stack">
      <h1>Main Admin</h1>

      <section className="card stack">
        <h2>Tenants</h2>
        {tenantsQ.isError && <div className="alert alert-error">Could not load tenants.</div>}
        <form className="row" onSubmit={(e) => { e.preventDefault(); createTenantM.mutate(tenantForm); }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="City name" value={tenantForm.name} onChange={(e) => setTenantForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input" style={{ maxWidth: 180 }} placeholder="slug" value={tenantForm.slug} onChange={(e) => setTenantForm((f) => ({ ...f, slug: e.target.value }))} />
          <button className="btn btn-primary btn-sm" disabled={!tenantForm.name || !tenantForm.slug || createTenantM.isPending}>Create tenant</button>
        </form>
        {createTenantM.isError && <div className="alert alert-error">{apiErrorMessage(createTenantM.error)}</div>}
        <table className="admin-table"><tbody>{tenantsQ.data?.map((t) => (
          <tr key={t.id}><td>{t.name}</td><td>{t.slug}</td><td>{t.isActive ? 'Active' : 'Disabled'}</td><td><button className="btn btn-sm" onClick={() => updateTenantM.mutate({ id: t.id, body: { isActive: !t.isActive } })}>{t.isActive ? 'Disable' : 'Enable'}</button></td></tr>
        ))}</tbody></table>
      </section>

      <section className="card stack">
        <h2>Tenant admins</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); createAdminM.mutate(adminForm); }}>
          <select className="input" style={{ maxWidth: 220 }} value={adminForm.tenantId} onChange={(e) => setAdminForm((f) => ({ ...f, tenantId: e.target.value }))}><option value="">Tenant</option>{tenantsQ.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input className="input" style={{ maxWidth: 200 }} placeholder="Full name" value={adminForm.fullName} onChange={(e) => setAdminForm((f) => ({ ...f, fullName: e.target.value }))} />
          <input className="input" style={{ maxWidth: 220 }} placeholder="Email" value={adminForm.email} onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input" style={{ maxWidth: 160 }} placeholder="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))} />
          <button className="btn btn-primary btn-sm" disabled={!adminForm.tenantId || !adminForm.email || !adminForm.password || !adminForm.fullName || createAdminM.isPending}>Create admin</button>
        </form>
        {createAdminM.isError && <div className="alert alert-error">{apiErrorMessage(createAdminM.error)}</div>}
        <div className="report-list">{tenantAdminsQ.data?.map((u) => <div className="report-item" key={u.id}><span>{u.fullName} · {u.email}</span><span className="muted">{u.tenantName}</span></div>)}</div>
      </section>

      <section className="card stack"><h2>All reports</h2><GlobalRows query={reportsQ} /></section>
      <section className="card stack"><h2>All work orders</h2><GlobalRows query={workOrdersQ} /></section>
      <section className="card stack"><h2>All responsible entities</h2><EntityRows query={entitiesQ} /></section>
    </div>
  );
}

function GlobalRows({ query }) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <div className="alert alert-error">Could not load data.</div>;
  if (!query.data?.items.length) return <p className="muted">No records.</p>;
  return <div className="report-list">{query.data.items.map((item) => <div className="report-item" key={item.id}><span>{item.title}</span><span className="muted">{item.tenantName} · {item.status}</span></div>)}</div>;
}

function EntityRows({ query }) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <div className="alert alert-error">Could not load entities.</div>;
  if (!query.data?.length) return <p className="muted">No responsible entities.</p>;
  return <div className="report-list">{query.data.map((entity) => <div className="report-item" key={entity.id}><span>{entity.name}<span className="report-meta" style={{ display: 'block' }}>{entityTypeLabel(entity.type)} · {entity.email || 'no email'}</span></span><span className="muted">{entity.tenantName} · {entity.isActive ? 'Enabled' : 'Disabled'}</span></div>)}</div>;
}
