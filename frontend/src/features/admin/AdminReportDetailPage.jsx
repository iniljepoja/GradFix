import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import * as reportsApi from '../../api/reports.js';
import { assetUrl } from '../../api/client.js';
import { STATUS_LABELS, PRIORITY_LABELS, PRIORITIES } from '../../lib/reportStatus.js';
import StatusPill from '../../components/StatusPill.jsx';
import PriorityPill from '../../components/PriorityPill.jsx';
import Spinner from '../../components/Spinner.jsx';
import StatusChangeDialog from './StatusChangeDialog.jsx';
import AssignDialog from './AssignDialog.jsx';
import MergeDuplicateDialog from './MergeDuplicateDialog.jsx';

const fmt = (s) => new Date(s).toLocaleString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function AdminReportDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null); // 'status' | 'assign' | 'merge'
  const [comment, setComment] = useState('');

  const reportQuery = useQuery({ queryKey: ['admin-report', id], queryFn: () => adminApi.getReport(id) });
  const historyQuery = useQuery({ queryKey: ['report-history', id], queryFn: () => reportsApi.history(id) });
  const commentsQuery = useQuery({ queryKey: ['admin-comments', id], queryFn: () => adminApi.listComments(id) });

  const priorityM = useMutation({
    mutationFn: (priority) => adminApi.updatePriority(id, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-report', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
  });
  const commentM = useMutation({
    mutationFn: () => adminApi.addComment(id, comment.trim()),
    onSuccess: () => { setComment(''); queryClient.invalidateQueries({ queryKey: ['admin-comments', id] }); },
  });

  if (reportQuery.isLoading) return <Spinner />;
  if (reportQuery.isError) {
    return (
      <div className="stack">
        <div className="alert alert-error">Could not load this report.</div>
        <Link className="btn" to="/admin/reports">Back to queue</Link>
      </div>
    );
  }
  const r = reportQuery.data;

  return (
    <div className="stack">
      <Link className="btn btn-ghost btn-sm" to="/admin/reports">‹ Back to queue</Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{r.title}</h1>
        <span className="row" style={{ gap: 8 }}><StatusPill status={r.status} /><PriorityPill priority={r.priority} /></span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        {/* Content */}
        <div className="stack" style={{ flex: '1 1 420px', minWidth: 0 }}>
          {r.photos?.length > 0 && (
            <div className="photo-grid">
              {r.photos.map((p, i) => (
                <a className="photo-thumb" key={p.id} href={assetUrl(p.url)} target="_blank" rel="noreferrer">
                  <img src={assetUrl(p.url)} alt={`Photo ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {r.description && (
            <div className="card"><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.description}</p></div>
          )}
          <div className="card stack">
            <strong>Location & reporter</strong>
            {r.address && <div>{r.address}</div>}
            <div className="report-meta">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)} · {r.categoryName}</div>
            <div className="report-meta">Reporter: {r.reporterEmail || '—'} · 👥 {r.upvoteCount} affected · filed {fmt(r.createdAt)}</div>
          </div>

          <div className="card stack">
            <strong>History</strong>
            {historyQuery.data && historyQuery.data.length === 0 && <p className="muted" style={{ margin: 0 }}>No status changes yet.</p>}
            {historyQuery.data && historyQuery.data.length > 0 && (
              <ol className="status-history">
                {historyQuery.data.map((h, i) => (
                  <li key={i} className="status-history-item">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      {h.fromStatus && <><span className="muted">{STATUS_LABELS[h.fromStatus]}</span><span className="muted">→</span></>}
                      <StatusPill status={h.toStatus} />
                    </div>
                    <div className="report-meta">{fmt(h.createdAt)}</div>
                    {h.note && <div style={{ marginTop: 4 }}>{h.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card stack">
            <strong>Internal comments</strong>
            <p className="field-hint" style={{ margin: 0 }}>Visible to staff only.</p>
            {commentsQuery.data?.map((c) => (
              <div key={c.id} className="status-history-item">
                <div className="report-meta">{c.authorName || 'Staff'} · {fmt(c.createdAt)}</div>
                <div>{c.body}</div>
              </div>
            ))}
            {commentsQuery.data && commentsQuery.data.length === 0 && <p className="muted" style={{ margin: 0 }}>No comments yet.</p>}
            <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (comment.trim()) commentM.mutate(); }}>
              <textarea className="input" rows={2} placeholder="Add an internal note…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" disabled={!comment.trim() || commentM.isPending}>Post</button>
              </div>
            </form>
          </div>
        </div>

        {/* Action rail */}
        <div className="stack" style={{ flex: '0 0 250px' }}>
          <div className="card stack">
            <strong>Status</strong>
            <div><StatusPill status={r.status} /></div>
            <button className="btn btn-primary btn-sm" onClick={() => setDialog('status')} disabled={r.status === 'closed'}>
              Change status
            </button>
          </div>
          <div className="card stack">
            <strong>Priority</strong>
            <select className="input" value={r.priority} disabled={priorityM.isPending}
              onChange={(e) => priorityM.mutate(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div className="card stack">
            <strong>Assignee</strong>
            <div>{r.assignedEntityName || <span className="muted">Unassigned</span>}</div>
            <button className="btn btn-sm" onClick={() => setDialog('assign')}>Reassign…</button>
          </div>
          <div className="card stack">
            <strong>Duplicate</strong>
            {r.duplicateOfId && <div className="report-meta">Merged into {r.duplicateOfId}</div>}
            <button className="btn btn-sm" disabled={r.status === 'closed' || !!r.duplicateOfId} onClick={() => setDialog('merge')}>
              Merge…
            </button>
          </div>
        </div>
      </div>

      {dialog === 'status' && <StatusChangeDialog report={r} onClose={() => setDialog(null)} />}
      {dialog === 'assign' && <AssignDialog report={r} onClose={() => setDialog(null)} />}
      {dialog === 'merge' && <MergeDuplicateDialog report={r} onClose={() => setDialog(null)} />}
    </div>
  );
}
