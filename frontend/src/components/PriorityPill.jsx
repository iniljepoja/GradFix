import { PRIORITY_LABELS } from '../lib/reportStatus.js';

export default function PriorityPill({ priority }) {
  return <span className={`pill priority-${priority}`}>{PRIORITY_LABELS[priority] || priority}</span>;
}
