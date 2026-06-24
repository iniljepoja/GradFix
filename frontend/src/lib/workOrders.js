export const WORK_ORDER_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  delivery_failed: 'Delivery failed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};

const CANCELLABLE = new Set(['draft', 'sent', 'delivery_failed', 'in_progress']);

export function canCancelWorkOrder(status) {
  return CANCELLABLE.has(status);
}

export function promptCancelReason() {
  const note = window.prompt('Why should this work order be cancelled?');
  return note?.trim() || null;
}
