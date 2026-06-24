import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import { entityTypeLabel } from '../../lib/entities.js';
import Modal from '../../components/Modal.jsx';

// Assignment workflow: pick a responsible entity (or fall back to the category's auto-route).
export default function AssignDialog({ report, onClose }) {
  const queryClient = useQueryClient();
  const entitiesQuery = useQuery({ queryKey: ['admin-entities'], queryFn: adminApi.listEntities });
  const routesQuery = useQuery({ queryKey: ['admin-routes'], queryFn: adminApi.listRoutes });

  const active = (entitiesQuery.data || []).filter((e) => e.isActive);
  const suggested = routesQuery.data?.find((r) => r.categoryId === report.categoryId);
  const [entityId, setEntityId] = useState(report.assignedEntityId || suggested?.responsibleEntityId || '');

  const mutation = useMutation({
    mutationFn: () => adminApi.assign(report.id, entityId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-report', report.id] });
      queryClient.invalidateQueries({ queryKey: ['report-history', report.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-assignment-history', report.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      onClose();
    },
  });

  const blocked = report.status === 'new'
    ? 'Accept the report before assigning it.'
    : ['resolved', 'closed'].includes(report.status)
      ? `A ${report.status} report can’t be reassigned.`
      : null;

  return (
    <Modal title="Assign report" onClose={onClose}>
      <div className="report-meta">Category: <strong>{report.categoryName || '—'}</strong></div>
      {suggested && <div className="report-meta">Suggested (auto-route): {suggested.responsibleEntityName}</div>}

      {blocked ? (
        <div className="alert alert-info">{blocked}</div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="assign-entity">Assign to</label>
            <select id="assign-entity" className="input" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">— Use category route —</option>
              {active.map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {entityTypeLabel(e.type)}</option>
              ))}
            </select>
          </div>
          {report.status === 'accepted' && <p className="field-hint">Assigning moves the report to “Assigned”.</p>}
          {mutation.isError && <div className="alert alert-error">{apiErrorMessage(mutation.error)}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
