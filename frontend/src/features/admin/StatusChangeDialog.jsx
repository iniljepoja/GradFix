import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import {
  STATUS_LABELS, nextStatuses, requiresStartedWorkOrder, requiresStatusReason,
} from '../../lib/reportStatus.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Modal from '../../components/Modal.jsx';

// Status-change workflow: offers only the transitions the backend allows from the current state.
export default function StatusChangeDialog({ report, onClose }) {
  const queryClient = useQueryClient();
  const options = nextStatuses(report.status);
  const [toStatus, setToStatus] = useState(options[0] || '');
  const [note, setNote] = useState('');
  const noteRequired = requiresStatusReason(report.status, toStatus);
  const blockedByWorkOrders = report.activeWorkOrderCount > 0 && ['resolved', 'closed'].includes(toStatus);
  const blockedByNoStartedWorkOrder = requiresStartedWorkOrder(report.status, toStatus) && !report.startedWorkOrderCount;

  const mutation = useMutation({
    mutationFn: () => adminApi.changeStatus(report.id, { toStatus, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-report', report.id] });
      queryClient.invalidateQueries({ queryKey: ['report-history', report.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      onClose();
    },
  });

  return (
    <Modal title="Change status" onClose={onClose}>
      {options.length === 0 ? (
        <p className="muted">This report is {STATUS_LABELS[report.status]} and can’t change further.</p>
      ) : (
        <>
          <div className="report-meta">Current: <strong>{STATUS_LABELS[report.status]}</strong></div>
          <div className="stack" style={{ gap: 8 }}>
            {options.map((s) => (
              <label key={s} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="radio" name="toStatus" value={s} checked={toStatus === s} onChange={() => setToStatus(s)} />
                {STATUS_LABELS[s]}{report.activeWorkOrderCount > 0 && ['resolved', 'closed'].includes(s) ? ' (blocked: active work orders)' : ''}
                {requiresStartedWorkOrder(report.status, s) && !report.startedWorkOrderCount ? ' (blocked: no sent/started work order)' : ''}
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor="status-note">Note {noteRequired ? '(required)' : '(optional, saved to history)'}</label>
            <textarea id="status-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {noteRequired && <p className="field-hint">Closing or reopening a report requires a reason.</p>}
          {blockedByWorkOrders && <div className="alert alert-info">Cancel or complete active Work Orders before marking this report {STATUS_LABELS[toStatus].toLowerCase()}.</div>}
          {blockedByNoStartedWorkOrder && <div className="alert alert-info">Send or start a Work Order before marking this report in progress.</div>}
          <p className="field-hint">ⓘ The reporter is emailed about this change.</p>
          {mutation.isError && <div className="alert alert-error">{apiErrorMessage(mutation.error)}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={mutation.isPending || blockedByWorkOrders || blockedByNoStartedWorkOrder || (noteRequired && !note.trim())} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Updating…' : 'Update'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
