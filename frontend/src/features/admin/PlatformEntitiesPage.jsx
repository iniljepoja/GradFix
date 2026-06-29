import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { ENTITY_TYPES, entityTypeLabel } from '../../lib/entities.js';
import Spinner from '../../components/Spinner.jsx';

const emptyForm = { tenantId: '', name: '', type: 'municipal_department', email: '', phone: '', notes: '' };
const clean = (form) => ({
  tenantId: form.tenantId, name: form.name.trim(), type: form.type,
  email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, notes: form.notes.trim() || undefined,
});

export default function PlatformEntitiesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const entitiesQ = useQuery({ queryKey: ['platform-entities'], queryFn: adminApi.listPlatformEntities });
  const tenants = tenantsQ.data || [];
  const tenantId = tenants.length === 1 ? tenants[0].id : form.tenantId;
  const createM = useMutation({
    mutationFn: () => adminApi.createPlatformEntity({ ...clean(form), tenantId }),
    onSuccess: () => { setForm(emptyForm); queryClient.invalidateQueries({ queryKey: ['platform-entities'] }); },
  });

  return (
    <div className="stack">
      <div><h1 style={{ margin: 0 }}>Responsible Entities</h1><p className="muted" style={{ margin: '4px 0 0' }}>Create tenant-specific entities from the platform panel.</p></div>

      <section className="card stack">
        <h2>Create entity</h2>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); createM.mutate(); }}>
          <div className="row">
            {tenants.length === 1 ? <span className="tenant-chip">{tenants[0].name}</span> : (
              <select className="input" style={{ maxWidth: 220 }} value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}><option value="" disabled>Choose tenant</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            )}
            <input className="input" style={{ maxWidth: 260 }} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="input" style={{ maxWidth: 220 }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{ENTITY_TYPES.map((type) => <option key={type} value={type}>{entityTypeLabel(type)}</option>)}</select>
            <input className="input" style={{ maxWidth: 240 }} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className="input" style={{ maxWidth: 180 }} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <textarea className="input" rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary btn-sm" disabled={!tenantId || !form.name.trim() || createM.isPending}>Create entity</button></div>
        </form>
        {createM.isError && <div className="alert alert-error">{apiErrorMessage(createM.error)}</div>}
      </section>

      <section className="card">
        {entitiesQ.isLoading && <Spinner />}
        {entitiesQ.isError && <div className="alert alert-error">Could not load responsible entities.</div>}
        {entitiesQ.data?.length > 0 && (
          <table className="admin-table"><thead><tr><th>Name</th><th>Tenant</th><th>Type</th><th>Contact</th><th>Status</th></tr></thead><tbody>
            {entitiesQ.data.map((entity) => <tr key={entity.id}><td><strong>{entity.name}</strong></td><td>{entity.tenantName}</td><td>{entityTypeLabel(entity.type)}</td><td>{entity.email || '—'}<div className="report-meta">{entity.phone || ''}</div></td><td>{entity.isActive ? 'Active' : 'Disabled'}</td></tr>)}
          </tbody></table>
        )}
      </section>
    </div>
  );
}
