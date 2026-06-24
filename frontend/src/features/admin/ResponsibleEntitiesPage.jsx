import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { ENTITY_TYPES, entityTypeLabel } from '../../lib/entities.js';
import Spinner from '../../components/Spinner.jsx';

const emptyForm = { name: '', type: 'municipal_department', email: '', phone: '', notes: '' };
const clean = (f) => ({
  name: f.name.trim(), type: f.type,
  email: f.email.trim() || undefined, phone: f.phone.trim() || undefined, notes: f.notes.trim() || undefined,
});

export default function ResponsibleEntitiesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const entitiesQ = useQuery({ queryKey: ['admin-entities'], queryFn: adminApi.listEntities });
  const saveM = useMutation({
    mutationFn: () => editingId ? adminApi.updateEntity(editingId, clean(form)) : adminApi.createEntity(clean(form)),
    onSuccess: () => { setForm(emptyForm); setEditingId(null); queryClient.invalidateQueries({ queryKey: ['admin-entities'] }); },
  });
  const toggleM = useMutation({
    mutationFn: ({ id, isActive }) => adminApi.updateEntity(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-entities'] }),
  });

  const edit = (e) => {
    setEditingId(e.id);
    setForm({ name: e.name || '', type: ENTITY_TYPES.includes(e.type) ? e.type : 'other', email: e.email || '', phone: e.phone || '', notes: e.notes || '' });
  };

  return (
    <div className="stack">
      <h1>Responsible Entities</h1>
      <section className="card stack">
        <h2>{editingId ? 'Edit entity' : 'Create entity'}</h2>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); saveM.mutate(); }}>
          <div className="row">
            <input className="input" style={{ maxWidth: 260 }} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="input" style={{ maxWidth: 220 }} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{entityTypeLabel(t)}</option>)}</select>
            <input className="input" style={{ maxWidth: 240 }} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className="input" style={{ maxWidth: 180 }} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <textarea className="input" rows={3} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          {saveM.isError && <div className="alert alert-error">{apiErrorMessage(saveM.error)}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {editingId && <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel edit</button>}
            <button className="btn btn-primary" disabled={!form.name.trim() || saveM.isPending}>{saveM.isPending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        {entitiesQ.isLoading && <Spinner />}
        {entitiesQ.isError && <div className="alert alert-error">Could not load entities.</div>}
        {entitiesQ.data?.length === 0 && <p className="muted">No responsible entities yet.</p>}
        {entitiesQ.data?.length > 0 && (
          <table className="admin-table"><thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {entitiesQ.data.map((entity) => <tr key={entity.id}>
              <td><strong>{entity.name}</strong>{entity.notes && <div className="report-meta">{entity.notes}</div>}</td>
              <td>{entityTypeLabel(entity.type)}</td>
              <td>{entity.email || '—'}<div className="report-meta">{entity.phone || ''}</div></td>
              <td>{entity.isActive ? 'Enabled' : 'Disabled'}</td>
              <td className="row"><button className="btn btn-sm" onClick={() => edit(entity)}>Edit</button><button className="btn btn-sm" disabled={toggleM.isPending} onClick={() => toggleM.mutate({ id: entity.id, isActive: !entity.isActive })}>{entity.isActive ? 'Disable' : 'Enable'}</button></td>
            </tr>)}
          </tbody></table>
        )}
      </section>
    </div>
  );
}
