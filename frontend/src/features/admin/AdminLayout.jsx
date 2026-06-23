import { NavLink, Outlet } from 'react-router-dom';

// Desktop-first admin shell: a left sidebar + the routed page. Sits inside the app's top bar.
const navClass = ({ isActive }) => (isActive ? 'admin-navlink admin-navlink-active' : 'admin-navlink');

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Admin</div>
        <NavLink to="/admin" end className={navClass}>Overview</NavLink>
        <NavLink to="/admin/reports" className={navClass}>📋 Reports</NavLink>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
