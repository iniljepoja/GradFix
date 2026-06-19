import { NavLink, Outlet } from 'react-router-dom';

// Desktop-first admin shell: a left sidebar + the routed page. Sits inside the app's top bar.
// Only the Reports section ships in this slice; Dashboard/Config/Users come in later slices.
const navClass = ({ isActive }) => (isActive ? 'admin-navlink admin-navlink-active' : 'admin-navlink');

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Admin</div>
        <NavLink to="/admin/reports" className={navClass}>📋 Reports</NavLink>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
