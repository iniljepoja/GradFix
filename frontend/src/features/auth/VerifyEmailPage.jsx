import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import * as authApi from '../../api/auth.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ran = useRef(false);
  const userEmail = user?.email || location.state?.email || '';

  const [status, setStatus] = useState(token ? 'verifying' : 'notice');
  const [error, setError] = useState('');
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | error

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

  const resend = async () => {
    setResendState('sending');
    try {
      if (user) {
        await authApi.resendVerification();
      } else if (userEmail) {
        await authApi.resendVerificationPublic(userEmail);
      } else {
        throw new Error('No email address to resend to.');
      }
      setResendState('sent');
    } catch (err) {
      setResendState('error');
      setError(apiErrorMessage(err, 'Could not resend verification email.'));
    }
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
            {user && (
              <button className="btn btn-primary" onClick={resend} disabled={resendState === 'sending' || resendState === 'sent'}>
                {resendState === 'sent' ? 'Verification email sent — check your inbox' : resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            <Link className="btn" to="/login">Back to login</Link>
          </>
        )}

        {status === 'notice' && (
          <>
            <div className="alert alert-info">
              Please verify your email{userEmail ? <> (<strong>{userEmail}</strong>)</> : null} using the
              link we sent you. You can browse the map, but reporting requires a verified account.
            </div>
            {(user || userEmail) && (
              <>
                <button className="btn btn-sm" onClick={resend} disabled={resendState === 'sending' || resendState === 'sent'}>
                  {resendState === 'sent' ? 'Verification email sent — check your inbox' : resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                </button>
                {resendState === 'error' && <span className="report-meta">{error}</span>}
                {user && <button className="btn btn-sm btn-primary" onClick={recheck}>I have verified — continue</button>}
                {!user && <Link className="btn btn-sm" to="/login">Back to login</Link>}
              </>
            )}
            {!user && !userEmail && <Link className="btn btn-sm" to="/login">Back to login</Link>}
          </>
        )}
      </div>
    </div>
  );
}
