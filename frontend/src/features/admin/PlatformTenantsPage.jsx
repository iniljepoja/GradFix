import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { geocodeCity } from '../../lib/geo.js';
import Spinner from '../../components/Spinner.jsx';

const emptyForm = { name: '', slug: '' };

function slugify(value) {
  return value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapUrl(tenant) {
  if (tenant.centerLat == null || tenant.centerLng == null) return null;
  return `/?lat=${tenant.centerLat}&lng=${tenant.centerLng}&zoom=13&label=${encodeURIComponent(tenant.name)}`;
}

export default function PlatformTenantsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const createM = useMutation({
    mutationFn: async (body) => {
      const center = await geocodeCity(body.name.trim());
      return adminApi.createPlatformTenant({ name: body.name.trim(), slug: body.slug.trim(), ...(center || {}) });
    },
    onSuccess: () => { setForm(emptyForm); setSlugEdited(false); queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }); },
  });
  const toggleM = useMutation({
    mutationFn: ({ id, isActive }) => adminApi.updatePlatformTenant(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Tenants</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Cities served by this GradFix deployment.</p>
      </div>

      <div className="alert alert-info">
        Suspending a tenant disables that city&apos;s public app and tenant-admin access. Existing reports, users, and work orders are kept and become available again when the tenant is activated.
      </div>

      <section className="card stack">
        <h2>Create tenant</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); createM.mutate(form); }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="City name" value={form.name} onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
          }} />
          <input className="input" style={{ maxWidth: 200 }} placeholder="slug" value={form.slug} onChange={(e) => { setSlugEdited(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} />
          <button className="btn btn-primary btn-sm" disabled={!form.name.trim() || !form.slug.trim() || createM.isPending}>{createM.isPending ? 'Creating…' : 'Create tenant'}</button>
        </form>
        <p className="field-hint">Map center is detected automatically from the city name. You can adjust it later in Tenant Details.</p>
        {createM.isError && <div className="alert alert-error">{apiErrorMessage(createM.error)}</div>}
      </section>

      <section className="card">
        {tenantsQ.isLoading && <Spinner />}
        {tenantsQ.isError && <div className="alert alert-error">Could not load tenants.</div>}
        {tenantsQ.data?.length > 0 && (
          <table className="admin-table">
            <thead><tr><th>City</th><th>Slug</th><th>Status</th><th>Map center</th><th>Actions</th></tr></thead>
            <tbody>{tenantsQ.data.map((tenant) => (
              <tr key={tenant.id}>
                <td><strong>{tenant.name}</strong></td>
                <td>{tenant.slug}</td>
                <td>{tenant.isActive ? 'Active' : 'Suspended'}</td>
                <td className="muted">{tenant.centerLat ?? '—'}, {tenant.centerLng ?? '—'}</td>
                <td className="row">
                  <Link className="btn btn-sm" to={`/admin/platform/tenants/${tenant.id}`}>View</Link>
                  {mapUrl(tenant) && <Link className="btn btn-sm" to={mapUrl(tenant)}>View on Map</Link>}
                  <button className="btn btn-sm" disabled={toggleM.isPending} onClick={() => toggleM.mutate({ id: tenant.id, isActive: !tenant.isActive })}>{tenant.isActive ? 'Suspend' : 'Activate'}</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
