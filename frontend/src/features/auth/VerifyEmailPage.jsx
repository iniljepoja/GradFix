import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import * as authApi from '../../api/auth.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  const [status, setStatus] = useState(token ? 'verifying' : 'notice');
  const [error, setError] = useState('');

  // Consume the token from the email link (guard against React StrictMode double-run).
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await authApi.verifyEmail(token);
        if (user) await refreshProfile().catch(() => {});
        setStatus('ok');
      } catch (err) {
        setError(apiErrorMessage(err, 'This verification link is invalid or has expired.'));
        setStatus('error');
      }
    })();
  }, [token, user, refreshProfile]);

  const recheck = async () => {
    try {
      const me = await refreshProfile();
      if (me.isEmailVerified) navigate('/dashboard', { replace: true });
    } catch { /* ignore */ }
  };

  return (
    <div className="auth-page">
      <div className="card stack center">
        <h1>Email verification</h1>

        {status === 'verifying' && <Spinner label="Verifying your email…" />}

        {status === 'ok' && (
          <>
            <div className="alert alert-ok">Your email is verified. You are all set!</div>
            <Link className="btn btn-primary" to={user ? '/dashboard' : '/login'}>
              {user ? 'Go to dashboard' : 'Log in'}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="alert alert-error">{error}</div>
            <Link className="btn" to="/login">Back to login</Link>
          </>
        )}

        {status === 'notice' && (
          <>
            <div className="alert alert-info">
              Please verify your email{user ? <> (<strong>{user.email}</strong>)</> : null} using the
              link we sent you. You can browse the map, but reporting requires a verified account.
            </div>
            {user && <button className="btn btn-primary" onClick={recheck}>I have verified — continue</button>}
            {!user && <Link className="btn" to="/login">Back to login</Link>}
          </>
        )}
      </div>
    </div>
  );
}
