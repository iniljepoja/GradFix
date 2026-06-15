import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as authApi from '../../api/auth.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Field from '../../components/Field.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'This reset link is invalid or has expired.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="card stack">
        <h1>Set a new password</h1>
        {!token && <div className="alert alert-error">Missing reset token. Use the link from your email.</div>}
        {done ? (
          <>
            <div className="alert alert-ok">Your password has been updated.</div>
            <Link className="btn btn-primary btn-block" to="/login">Log in</Link>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form className="stack" onSubmit={onSubmit}>
              <Field label="New password" id="password" type="password" autoComplete="new-password"
                required hint="At least 8 characters." value={password}
                onChange={(e) => setPassword(e.target.value)} />
              <Field label="Confirm password" id="confirm" type="password" autoComplete="new-password"
                required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <button className="btn btn-primary btn-block" disabled={busy || !token}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
