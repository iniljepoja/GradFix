import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as authApi from '../../api/auth.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Field from '../../components/Field.jsx';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      await authApi.register(form);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your account.'));
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="card stack center">
          <h1>Check your email</h1>
          <p className="muted">
            We sent a verification link to <strong>{form.email}</strong>. Open it to activate your
            account, then log in.
          </p>
          <Link className="btn btn-primary" to="/login">Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card stack">
        <h1>Create your account</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="stack" onSubmit={onSubmit}>
          <Field label="Full name" id="fullName" required value={form.fullName} onChange={set('fullName')} />
          <Field label="Email" id="email" type="email" autoComplete="email" required
            value={form.email} onChange={set('email')} />
          <Field label="Password" id="password" type="password" autoComplete="new-password" required
            hint="At least 8 characters." value={form.password} onChange={set('password')} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="center">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
