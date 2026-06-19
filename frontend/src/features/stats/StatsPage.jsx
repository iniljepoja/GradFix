import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as statsApi from '../../api/stats.js';
import { STATUS_LABELS } from '../../lib/reportStatus.js';
import Spinner from '../../components/Spinner.jsx';

// Public, read-only view of the tenant's aggregate report statistics.
export default function StatsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-stats'],
    queryFn: statsApi.publicStats,
  });

  if (isLoading) return <div className="page"><Spinner /></div>;
  if (isError) {
    return (
      <div className="page stack">
        <div className="alert alert-error">Could not load statistics right now.</div>
        <Link className="btn" to="/">Back to map</Link>
      </div>
    );
  }

  const statusMax = Math.max(1, ...data.byStatus.map((s) => s.count));
  const categoryMax = Math.max(1, ...data.byCategory.map((c) => c.count));

  return (
    <div className="page stack">
      <h1>Community statistics</h1>
      <p className="muted">A live overview of reports filed in this municipality.</p>

      <div className="row">
        <div className="card stat-card" style={{ flex: '1 1 180px' }}>
          <div className="stat-value">{data.total}</div>
          <div className="stat-label">Total reports</div>
        </div>
        <div className="card stat-card" style={{ flex: '1 1 180px' }}>
          <div className="stat-value">{data.resolvedPct}%</div>
          <div className="stat-label">Resolved or closed</div>
        </div>
      </div>

      <div className="card stack">
        <h2>By status</h2>
        {data.byStatus.length === 0 && <p className="muted" style={{ margin: 0 }}>No reports yet.</p>}
        {data.byStatus.map((s) => (
          <div className="bar-row" key={s.status}>
            <span className="bar-label">{STATUS_LABELS[s.status] || s.status}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(s.count / statusMax) * 100}%` }} />
            </span>
            <span className="bar-count">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h2>By category</h2>
        {data.byCategory.length === 0 && <p className="muted" style={{ margin: 0 }}>No categories configured.</p>}
        {data.byCategory.map((c) => (
          <div className="bar-row" key={c.categoryId}>
            <span className="bar-label">{c.name}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(c.count / categoryMax) * 100}%` }} />
            </span>
            <span className="bar-count">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
