import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function PlatformAdminPage() {
  const { user } = useAuth();
  const tenantsQ = useQuery({ queryKey: ['platform-tenants'], queryFn: adminApi.listPlatformTenants });
  const reportsQ = useQuery({ queryKey: ['platform-reports'], queryFn: () => adminApi.listPlatformReports({ limit: 1 }) });
  const workOrdersQ = useQuery({ queryKey: ['platform-work-orders'], queryFn: () => adminApi.listPlatformWorkOrders({ limit: 1 }) });
  const adminsQ = useQuery({ queryKey: ['platform-tenant-admins'], queryFn: adminApi.listPlatformTenantAdmins });

  if (user?.role !== 'super_admin') return <div className="alert alert-error">Main Admin access required.</div>;
  if (tenantsQ.isLoading) return <Spinner />;

  const tenants = tenantsQ.data || [];
  const active = tenants.filter((t) => t.isActive).length;

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Platform Overview</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Main Admin manages platform structure, not city operations.</p>
      </div>

      <div className="row">
        <Kpi label="Tenants" value={tenants.length} />
        <Kpi label="Active tenants" value={active} />
        <Kpi label="Suspended" value={tenants.length - active} />
        <Kpi label="Reports" value={reportsQ.data?.meta.total ?? '—'} />
        <Kpi label="Work orders" value={workOrdersQ.data?.meta.total ?? '—'} />
        <Kpi label="Tenant admins" value={adminsQ.data?.length ?? '—'} />
      </div>

      <section className="card stack">
        <h2>Platform tasks</h2>
        <div className="row">
          <Link className="btn btn-primary btn-sm" to="/admin/platform/tenants">Manage tenants</Link>
          <Link className="btn btn-sm" to="/admin/platform/admins">Tenant admins</Link>
          <Link className="btn btn-sm" to="/admin/platform/entities">Responsible entities</Link>
          <Link className="btn btn-sm" to="/admin/platform/reports">All reports</Link>
          <Link className="btn btn-sm" to="/admin/platform/work-orders">All work orders</Link>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }) {
  return <div className="card stat-card" style={{ flex: '1 1 140px' }}><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}
