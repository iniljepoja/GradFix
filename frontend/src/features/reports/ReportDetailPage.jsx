import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import * as reportsApi from '../../api/reports.js';
import { assetUrl } from '../../api/client.js';
import { STATUS_LABELS, PRIORITY_LABELS } from '../../lib/reportStatus.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import StatusPill from '../../components/StatusPill.jsx';
import Spinner from '../../components/Spinner.jsx';

const fmtDateTime = (s) =>
  new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // The detail endpoint is public and doesn't expose whether *this* user has upvoted, so we track
  // the toggle locally; the server returns the authoritative count on every action and reconciles it.
  const [upvoted, setUpvoted] = useState(false);

  const reportQuery = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.getById(id),
  });
  const historyQuery = useQuery({
    queryKey: ['report-history', id],
    queryFn: () => reportsApi.history(id),
  });

  const upvoteMutation = useMutation({
    mutationFn: (next) => (next ? reportsApi.upvote(id) : reportsApi.removeUpvote(id)),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ['report', id] });
      const prev = queryClient.getQueryData(['report', id]);
      const prevUpvoted = upvoted;
      setUpvoted(next);
      queryClient.setQueryData(['report', id], (r) =>
        r ? { ...r, upvoteCount: Math.max(0, r.upvoteCount + (next ? 1 : -1)) } : r);
      return { prev, prevUpvoted };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['report', id], ctx.prev);
      setUpvoted(ctx?.prevUpvoted ?? false);
    },
    onSuccess: (data) => {
      // Trust the server's count + upvoted flag (covers the "already upvoted" idempotent case).
      setUpvoted(data.upvoted);
      queryClient.setQueryData(['report', id], (r) =>
        r ? { ...r, upvoteCount: data.upvoteCount } : r);
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
    },
  });

  const onUpvote = () => {
    if (!user) { navigate('/login', { state: { from: `/reports/${id}` } }); return; }
    if (upvoteMutation.isPending) return;
    upvoteMutation.mutate(!upvoted);
  };

  if (reportQuery.isLoading) return <div className="page"><Spinner /></div>;
  if (reportQuery.isError) {
    return (
      <div className="page stack">
        <div className="alert alert-error">Could not load this report. It may have been removed.</div>
        <Link className="btn" to="/">Back to map</Link>
      </div>
    );
  }

  const report = reportQuery.data;

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Link className="btn btn-ghost btn-sm" to="/">← Back to map</Link>
        <StatusPill status={report.status} />
      </div>

      <h1>{report.title}</h1>
      <div className="report-meta">
        Filed {fmtDateTime(report.createdAt)} · Priority: {PRIORITY_LABELS[report.priority] || report.priority}
        {report.resolvedAt && ` · Resolved ${fmtDateTime(report.resolvedAt)}`}
      </div>

      {report.photos?.length > 0 && (
        <div className="photo-grid">
          {report.photos.map((p, i) => (
            <a className="photo-thumb" key={p.id} href={assetUrl(p.url)} target="_blank" rel="noreferrer">
              <img src={assetUrl(p.url)} alt={`Report photo ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${upvoted ? 'btn-primary' : ''}`}
            onClick={onUpvote}
            disabled={upvoteMutation.isPending}
            aria-pressed={upvoted}
          >
            ▲ {upvoted ? 'Upvoted' : 'Upvote'} · {report.upvoteCount}
          </button>
          {!user && <span className="report-meta">Log in to upvote</span>}
        </div>
        {upvoteMutation.isError && (
          <div className="alert alert-error">{apiErrorMessage(upvoteMutation.error, 'Could not record your vote.')}</div>
        )}
      </div>

      {report.description && (
        <div className="card stack">
          <h2>Description</h2>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{report.description}</p>
        </div>
      )}

      <div className="card stack">
        <h2>Location</h2>
        {report.address && <div>{report.address}</div>}
        <div className="report-meta">{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</div>
        <a className="btn btn-sm" target="_blank" rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=18/${report.latitude}/${report.longitude}`}>
          Open in OpenStreetMap
        </a>
      </div>

      <div className="card stack">
        <h2>Status history</h2>
        {historyQuery.isLoading && <Spinner />}
        {historyQuery.isError && <div className="alert alert-error">Could not load the status history.</div>}
        {historyQuery.data && historyQuery.data.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>No status updates yet — this report is awaiting review.</p>
        )}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <ol className="status-history">
            {historyQuery.data.map((h, i) => (
              <li key={i} className="status-history-item">
                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  {h.fromStatus && (
                    <>
                      <span className="muted">{STATUS_LABELS[h.fromStatus] || h.fromStatus}</span>
                      <span className="muted">→</span>
                    </>
                  )}
                  <StatusPill status={h.toStatus} />
                </div>
                <div className="report-meta">{fmtDateTime(h.createdAt)}</div>
                {h.note && <div style={{ marginTop: 4 }}>{h.note}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
