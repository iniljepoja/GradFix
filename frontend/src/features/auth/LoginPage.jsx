import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiErrorMessage } from '../../lib/apiError.js';
import { homeForRole, isStaff } from '../../lib/roles.js';
import Field from '../../components/Field.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const profile = await login(email, password);
      const blockedForStaff = from === '/dashboard' || from === '/reports/new';
      const blockedForCitizen = from.startsWith('/admin');
      const target = (isStaff(profile) && blockedForStaff) || (!isStaff(profile) && blockedForCitizen)
        ? homeForRole(profile)
        : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid email or password.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="card stack">
        <h1>Log in</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Email" id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="muted center"><Link to="/forgot-password">Forgot your password?</Link></p>
        <p className="center">No account? <Link to="/register">Sign up</Link></p>
      </div>
    </div>
  );
}
