import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

// Guards routes that need a signed-in user. `requireVerified` additionally blocks
// users who haven't confirmed their email (e.g. report creation).
export default function ProtectedRoute({ children, requireVerified = false }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Spinner label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (requireVerified && !user.isEmailVerified) return <Navigate to="/verify-email" replace />;
  return children;
}
