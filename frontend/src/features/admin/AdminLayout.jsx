import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../lib/roles.js';

// Desktop-first admin shell: a left sidebar + the routed page. Sits inside the app's top bar.
const navClass = ({ isActive }) => (isActive ? 'admin-navlink admin-navlink-active' : 'admin-navlink');

export default function AdminLayout() {
  const { user } = useAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Admin</div>
        <NavLink to="/admin" end className={navClass}>Overview</NavLink>
        <NavLink to="/admin/reports" className={navClass}>Reports</NavLink>
        <NavLink to="/admin/work-orders" className={navClass}>Work Orders</NavLink>
        {can(user, 'config') && <NavLink to="/admin/entities" className={navClass}>Responsible Entities</NavLink>}
        {user?.role === 'super_admin' && <NavLink to="/admin/platform" className={navClass}>Main Admin</NavLink>}
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
