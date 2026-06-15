import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as authApi from '../../api/auth.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Field from '../../components/Field.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true); // backend responds the same whether or not the email exists
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="card stack">
        <h1>Reset your password</h1>
        {done ? (
          <>
            <div className="alert alert-ok">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </div>
            <p className="center"><Link to="/login">Back to login</Link></p>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <p className="muted">Enter your email and we will send a link to set a new password.</p>
            <form className="stack" onSubmit={onSubmit}>
              <Field label="Email" id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="center"><Link to="/login">Back to login</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
