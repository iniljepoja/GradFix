import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeForRole, isCitizen } from '../lib/roles.js';
import Spinner from './Spinner.jsx';

// Guards citizen-only workflows such as filing reports and viewing personal report history.
export default function CitizenRoute({ children, requireVerified = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Spinner label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isCitizen(user)) return <Navigate to={homeForRole(user)} replace />;
  if (requireVerified && !user.isEmailVerified) return <Navigate to="/verify-email" replace />;
  return children;
}
