import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiErrorMessage } from '../../lib/apiError.js';
import { can } from '../../lib/roles.js';
import {
  canCancelWorkOrder, canCompleteWorkOrder, canSendWorkOrder, canStartWorkOrder,
  promptCancelReason, WORK_ORDER_STATUS_LABELS,
} from '../../lib/workOrders.js';
import Spinner from '../../components/Spinner.jsx';

const fmt = (s) => s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-work-orders'],
    queryFn: () => adminApi.listWorkOrders({ limit: 100 }),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-work-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-work-order'] });
  };
  const cancelM = useMutation({
    mutationFn: ({ id, note }) => adminApi.changeWorkOrderStatus(id, { toStatus: 'cancelled', note }),
    onSuccess: invalidate,
  });
  const sendM = useMutation({ mutationFn: (id) => adminApi.sendWorkOrder(id), onSuccess: invalidate });
  const statusM = useMutation({
    mutationFn: ({ id, toStatus }) => adminApi.changeWorkOrderStatus(id, { toStatus }),
    onSuccess: invalidate,
  });
  const regenerateM = useMutation({
    mutationFn: (id) => adminApi.regenerateWorkOrderDocument(id),
    onSuccess: invalidate,
  });
  const downloadM = useMutation({
    mutationFn: (id) => adminApi.downloadWorkOrderDocument(id),
    onSuccess: saveDownload,
  });

  const onCancel = (wo) => {
    const note = promptCancelReason();
    if (!note) return;
    cancelM.mutate({ id: wo.id, note });
  };
  const actionPending = cancelM.isPending || sendM.isPending || statusM.isPending || regenerateM.isPending || downloadM.isPending;
  const actionError = cancelM.error || sendM.error || statusM.error || regenerateM.error || downloadM.error;

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Work Orders</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Operational tasks created from accepted reports.</p>
      </div>

      <div className="card">
        {isLoading && <Spinner />}
        {isError && <div className="alert alert-error">Could not load work orders.</div>}
        {actionError && <div className="alert alert-error">{apiErrorMessage(actionError)}</div>}
        {data && data.items.length === 0 && <p className="muted" style={{ margin: 0 }}>No work orders yet. Open a report and create one from its Work Orders panel.</p>}
        {data && data.items.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Work order</th><th>Status</th><th>Report</th><th>Entity</th><th>Due</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((wo) => (
                <Fragment key={wo.id}>
                  <tr>
                    <td>{wo.title}</td>
                    <td><WorkOrderPill status={wo.status} /></td>
                    <td><Link to={`/admin/reports/${wo.reportId}`}>{wo.reportTitle}</Link></td>
                    <td>{wo.responsibleEntityName}</td>
                    <td className="muted">{fmt(wo.dueAt)}</td>
                    <td className="muted">{fmt(wo.createdAt)}</td>
                    <td>
                      <WorkOrderActions
                        workOrder={wo}
                        canManage={can(user, 'workOrder')}
                        disabled={actionPending}
                        onSend={() => sendM.mutate(wo.id)}
                        onStart={() => statusM.mutate({ id: wo.id, toStatus: 'in_progress' })}
                        onComplete={() => statusM.mutate({ id: wo.id, toStatus: 'completed' })}
                        onRegenerate={() => regenerateM.mutate(wo.id)}
                        onDownload={() => downloadM.mutate(wo.id)}
                        onCancel={() => onCancel(wo)}
                      />
                      <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => setExpandedId(expandedId === wo.id ? null : wo.id)}>
                        {expandedId === wo.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === wo.id && (
                    <tr>
                      <td colSpan={7}><WorkOrderDetails id={wo.id} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function WorkOrderPill({ status }) {
  return <span className={`pill work-order-${status}`}>{WORK_ORDER_STATUS_LABELS[status] || status}</span>;
}

export function WorkOrderActions({
  workOrder, canManage, disabled, onSend, onStart, onComplete, onRegenerate, onDownload, onCancel,
}) {
  if (!canManage) return <span className="muted">—</span>;
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      {canSendWorkOrder(workOrder.status) && <button className="btn btn-sm" disabled={disabled} onClick={onSend}>{workOrder.status === 'delivery_failed' ? 'Retry send' : 'Send'}</button>}
      {canStartWorkOrder(workOrder.status) && <button className="btn btn-sm" disabled={disabled} onClick={onStart}>Start</button>}
      {canCompleteWorkOrder(workOrder.status) && <button className="btn btn-sm" disabled={disabled} onClick={onComplete}>Complete</button>}
      <button className="btn btn-sm" disabled={disabled} onClick={onRegenerate}>Regenerate</button>
      <button className="btn btn-sm" disabled={disabled} onClick={onDownload}>Download PDF</button>
      {canCancelWorkOrder(workOrder.status) && <button className="btn btn-sm" disabled={disabled} onClick={onCancel}>Cancel</button>}
    </span>
  );
}

export function WorkOrderDetails({ id }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-work-order', id],
    queryFn: () => adminApi.getWorkOrder(id),
  });
  if (isLoading) return <Spinner />;
  if (isError) return <div className="alert alert-error">Could not load work order details.</div>;
  return (
    <div className="stack" style={{ padding: '8px 0' }}>
      <div className="report-meta">Created {fmt(data.createdAt)} · sent {fmt(data.sentAt)} · completed {fmt(data.completedAt)}</div>
      {data.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{data.description}</p>}
      <HistoryList title="Documents" items={data.documents} empty="No generated documents yet." render={(doc) => `Version ${doc.version} · generated ${fmt(doc.generatedAt)}`} />
      <HistoryList title="Deliveries" items={data.deliveries} empty="No delivery attempts yet." render={(d) => `${d.status} · ${d.recipientEmail || 'no recipient'} · attempts ${d.attemptCount} · ${fmt(d.sentAt || d.failedAt || d.queuedAt)}${d.lastError ? ` · ${d.lastError}` : ''}`} />
      <HistoryList title="Events" items={data.events} empty="No events yet." render={(e) => `${eventLabel(e.eventType)}${e.fromStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ''} · ${fmt(e.createdAt)}${e.note ? ` · ${e.note}` : ''}`} />
    </div>
  );
}

function HistoryList({ title, items = [], empty, render }) {
  return (
    <div>
      <strong>{title}</strong>
      {items.length === 0 && <p className="muted" style={{ margin: '4px 0 0' }}>{empty}</p>}
      {items.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{items.map((item) => <li key={item.id} className="report-meta">{render(item)}</li>)}</ul>}
    </div>
  );
}

function eventLabel(type) {
  return (type || '').replace('work_order.', '').replaceAll('_', ' ');
}

function saveDownload({ blob, fileName }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
