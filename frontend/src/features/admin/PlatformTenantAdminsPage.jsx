import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Spinner from '../../components/Spinner.jsx';

export default function PlatformTenantAdminsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ tenantId: '', email: '', password: '', fullName: '' });
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const adminsQ = useQuery({ queryKey: ['platform-tenant-admins'], queryFn: adminApi.listPlatformTenantAdmins });
  const tenants = tenantsQ.data || [];
  const tenantId = tenants.length === 1 ? tenants[0].id : form.tenantId;
  const createM = useMutation({
    mutationFn: () => adminApi.createPlatformTenantAdmin({ ...form, tenantId }),
    onSuccess: () => { setForm({ tenantId: '', email: '', password: '', fullName: '' }); queryClient.invalidateQueries({ queryKey: ['platform-tenant-admins'] }); },
  });

  return (
    <div className="stack">
      <div><h1 style={{ margin: 0 }}>Tenant Admins</h1><p className="muted" style={{ margin: '4px 0 0' }}>Create admin accounts for individual cities.</p></div>
      <section className="card stack">
        <h2>Create tenant admin</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); createM.mutate(form); }}>
          {tenants.length === 1 ? <span className="tenant-chip">{tenants[0].name}</span> : (
            <select className="input" style={{ maxWidth: 220 }} value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}><option value="" disabled>Choose tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          )}
          <input className="input" style={{ maxWidth: 200 }} placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <input className="input" style={{ maxWidth: 220 }} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input" style={{ maxWidth: 160 }} placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <button className="btn btn-primary btn-sm" disabled={!tenantId || !form.email || !form.password || !form.fullName || createM.isPending}>Create admin</button>
        </form>
        {createM.isError && <div className="alert alert-error">{apiErrorMessage(createM.error)}</div>}
      </section>

      <section className="card">
        {adminsQ.isLoading && <Spinner />}
        {adminsQ.isError && <div className="alert alert-error">Could not load tenant admins.</div>}
        {adminsQ.data?.length > 0 && <div className="report-list">{adminsQ.data.map((u) => <div className="report-item" key={u.id}><span>{u.fullName} · {u.email}</span><span className="muted">{u.tenantName}</span></div>)}</div>}
      </section>
    </div>
  );
}
