import { STATUS_LABELS } from '../lib/reportStatus.js';

export default function StatusPill({ status }) {
  return <span className={`pill status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
