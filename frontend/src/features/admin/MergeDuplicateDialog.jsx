import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../lib/apiError.js';
import Modal from '../../components/Modal.jsx';
import StatusPill from '../../components/StatusPill.jsx';

// Duplicate merge: choose the canonical report that will remain open/tracked.
export default function MergeDuplicateDialog({ report, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [canonicalId, setCanonicalId] = useState('');

  const candidatesQuery = useQuery({
    queryKey: ['admin-merge-candidates', report.id, report.categoryId, submittedSearch],
    queryFn: () => adminApi.listReports({
      categoryId: report.categoryId,
      q: submittedSearch || undefined,
      sort: 'recent',
      limit: 12,
    }),
  });

  const candidates = (candidatesQuery.data?.items || [])
    .filter((r) => r.id !== report.id && !r.duplicateOfId);

  const mutation = useMutation({
    mutationFn: () => adminApi.mergeDuplicate(report.id, canonicalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-report', report.id] });
      queryClient.invalidateQueries({ queryKey: ['report-history', report.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      onClose();
    },
  });

  const blocked = report.status === 'closed'
    ? 'Closed reports can’t be merged again.'
    : report.duplicateOfId
      ? 'This report is already marked as a duplicate.'
      : null;

  return (
    <Modal title="Merge duplicate" onClose={onClose}>
      {blocked ? (
        <div className="alert alert-info">{blocked}</div>
      ) : (
        <>
          <p className="report-meta" style={{ margin: 0 }}>
            Mark this report as a duplicate. The selected canonical report stays active; this report will be closed.
          </p>

          <form
            className="row"
            style={{ gap: 8 }}
            onSubmit={(e) => { e.preventDefault(); setSubmittedSearch(search.trim()); }}
          >
            <input
              className="input"
              placeholder="Search canonical report…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-sm" type="submit">Search</button>
          </form>

          {candidatesQuery.isLoading && <p className="muted" style={{ margin: 0 }}>Loading possible matches…</p>}
          {candidatesQuery.isError && <div className="alert alert-error">Could not load possible matches.</div>}
          {!candidatesQuery.isLoading && candidates.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>No matching canonical reports in this category.</p>
          )}

          {candidates.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              {candidates.map((candidate) => (
                <label key={candidate.id} className="merge-candidate">
                  <input
                    type="radio"
                    name="canonicalId"
                    value={candidate.id}
                    checked={canonicalId === candidate.id}
                    onChange={() => setCanonicalId(candidate.id)}
                  />
                  <span className="stack" style={{ gap: 4 }}>
                    <strong>{candidate.title}</strong>
                    <span className="report-meta">
                      <StatusPill status={candidate.status} /> · {candidate.upvoteCount} affected · {new Date(candidate.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {mutation.isError && <div className="alert alert-error">{apiErrorMessage(mutation.error)}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canonicalId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
