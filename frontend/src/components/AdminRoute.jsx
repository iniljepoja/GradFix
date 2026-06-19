import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isStaff } from '../lib/roles.js';
import Spinner from './Spinner.jsx';

// Guards the admin panel: signed-in staff only. Citizens are bounced to the public app.
export default function AdminRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Spinner label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isStaff(user)) return <Navigate to="/" replace />;
  return children;
}
