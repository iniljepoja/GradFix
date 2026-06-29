import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Desktop-first admin shell: a left sidebar + the routed page. Sits inside the app's top bar.
const navClass = ({ isActive }) => (isActive ? 'admin-navlink admin-navlink-active' : 'admin-navlink');

export default function AdminLayout() {
  const { user } = useAuth();
  const isMainAdmin = user?.role === 'super_admin';
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">{isMainAdmin ? 'Main Admin' : 'Tenant Admin'}</div>
        {isMainAdmin ? (
          <>
            <NavLink to="/admin/platform" end className={navClass}>Overview</NavLink>
            <NavLink to="/admin/platform/tenants" className={navClass}>Tenants</NavLink>
            <NavLink to="/admin/platform/admins" className={navClass}>Tenant Admins</NavLink>
            <NavLink to="/admin/platform/entities" className={navClass}>Responsible Entities</NavLink>
            <NavLink to="/admin/platform/reports" className={navClass}>All Reports</NavLink>
            <NavLink to="/admin/platform/work-orders" className={navClass}>All Work Orders</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/admin" end className={navClass}>Overview</NavLink>
            <NavLink to="/admin/reports" className={navClass}>Reports</NavLink>
            <NavLink to="/admin/work-orders" className={navClass}>Work Orders</NavLink>
            <NavLink to="/admin/entities" className={navClass}>Responsible Entities</NavLink>
          </>
        )}
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
