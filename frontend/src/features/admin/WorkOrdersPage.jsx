import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiErrorMessage } from '../../lib/apiError.js';
import { can } from '../../lib/roles.js';
import { canCancelWorkOrder, promptCancelReason, WORK_ORDER_STATUS_LABELS } from '../../lib/workOrders.js';
import Spinner from '../../components/Spinner.jsx';

const fmt = (s) => s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-work-orders'],
    queryFn: () => adminApi.listWorkOrders({ limit: 100 }),
  });
  const cancelM = useMutation({
    mutationFn: ({ id, note }) => adminApi.changeWorkOrderStatus(id, { toStatus: 'cancelled', note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-work-orders'] }),
  });

  const onCancel = (wo) => {
    const note = promptCancelReason();
    if (!note) return;
    cancelM.mutate({ id: wo.id, note });
  };

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Work Orders</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Operational tasks created from accepted reports.</p>
      </div>

      <div className="card">
        {isLoading && <Spinner />}
        {isError && <div className="alert alert-error">Could not load work orders.</div>}
        {cancelM.isError && <div className="alert alert-error">{apiErrorMessage(cancelM.error)}</div>}
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
                <tr key={wo.id}>
                  <td>{wo.title}</td>
                  <td><WorkOrderPill status={wo.status} /></td>
                  <td><Link to={`/admin/reports/${wo.reportId}`}>{wo.reportTitle}</Link></td>
                  <td>{wo.responsibleEntityName}</td>
                  <td className="muted">{fmt(wo.dueAt)}</td>
                  <td className="muted">{fmt(wo.createdAt)}</td>
                  <td>
                    {can(user, 'workOrder') && canCancelWorkOrder(wo.status) ? (
                      <button className="btn btn-sm" disabled={cancelM.isPending} onClick={() => onCancel(wo)}>Cancel</button>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
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
