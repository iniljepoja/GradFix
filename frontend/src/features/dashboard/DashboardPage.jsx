import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import * as reportsApi from '../../api/reports.js';
import BadgeCard from '../../components/BadgeCard.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import Spinner from '../../components/Spinner.jsx';

const fmtDate = (s) => new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function DashboardPage() {
  const { user } = useAuth();
  const isCitizen = user.role === 'citizen';
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => reportsApi.listMine({ limit: 50 }),
  });

  return (
    <div className="page stack">
      <h1>Dashboard</h1>

      {!user.isEmailVerified && (
        <div className="alert alert-info">
          Your email is not verified yet. <Link to="/verify-email">Verify now</Link> to file reports.
        </div>
      )}

      <div className="row">
        <div className="card stack" style={{ flex: '1 1 260px' }}>
          <h2>Profile</h2>
          <div><strong>{user.fullName}</strong></div>
          <div className="muted">{user.email}</div>
          <div>
            <span className="pill status-accepted">{user.role.replace('_', ' ')}</span>{' '}
            {user.isEmailVerified
              ? <span className="pill status-resolved">verified</span>
              : <span className="pill status-new">unverified</span>}
          </div>
        </div>

        {isCitizen && (
          <div style={{ flex: '1 1 260px' }}>
            <BadgeCard reportCount={user.reportCount} badge={user.badge} nextBadge={user.nextBadge} />
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Your reports</h2>
          <Link className="btn btn-primary btn-sm" to="/reports/new">New report</Link>
        </div>

        {isLoading && <Spinner />}
        {isError && <div className="alert alert-error">Could not load your reports.</div>}
        {data && data.items.length === 0 && (
          <p className="muted">No reports yet. <Link to="/reports/new">File your first one</Link>.</p>
        )}
        {data && data.items.length > 0 && (
          <div className="report-list">
            {data.items.map((r) => (
              <div className="report-item card" key={r.id}>
                <div>
                  <h3>{r.title}</h3>
                  <div className="report-meta">Filed {fmtDate(r.createdAt)}</div>
                </div>
                <div className="stack" style={{ textAlign: 'right' }}>
                  <StatusPill status={r.status} />
                  <span className="report-meta">▲ {r.upvoteCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
