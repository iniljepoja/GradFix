import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isStaff } from '../lib/roles.js';
import InstallPrompt from './InstallPrompt.jsx';
import OfflineIndicator from './OfflineIndicator.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => { await logout(); navigate('/'); };
  const navClass = ({ isActive }) => (isActive ? 'navlink navlink-active' : 'navlink');

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">GradFix</Link>
        <nav className="nav">
          <NavLink to="/" className={navClass} end>Map</NavLink>
          <NavLink to="/stats" className={navClass}>Stats</NavLink>
          {user && <NavLink to="/reports/new" className={navClass}>Report</NavLink>}
          {user && <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>}
          {isStaff(user) && <NavLink to="/admin/reports" className={navClass}>Admin</NavLink>}
        </nav>
        <div className="nav-auth">
          {user ? (
            <>
              <span className="nav-user" title={user.email}>{user.fullName}</span>
              <button className="btn btn-ghost" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>Log in</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">Sign up</NavLink>
            </>
          )}
        </div>
      </header>
      <OfflineIndicator />
      <main className="content">{children}</main>
      <InstallPrompt />
    </div>
  );
}
