export const STATUS_LABELS = {
  new: 'New', accepted: 'Accepted', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

export const PRIORITY_LABELS = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Allowed status transitions — mirrors STATUS_TRANSITIONS in backend report.service.js so the admin
// UI only offers moves the API will accept. `new` is the initial state only (staff can't set it).
export const STATUS_TRANSITIONS = {
  new: ['accepted', 'closed'],
  accepted: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export const nextStatuses = (status) => STATUS_TRANSITIONS[status] || [];
