// Staff roles that may access the admin panel (mirrors the backend STAFF set in admin.routes.js).
export const STAFF_ROLES = ['reviewer', 'conductor', 'community_manager', 'tenant_admin', 'super_admin'];

export const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);
export const isCitizen = (user) => user?.role === 'citizen';
export const homeForRole = (user) => (isStaff(user) ? '/admin/reports' : '/dashboard');

// Per-action permissions — mirrors the route-level authorize() gates in admin.routes.js so the UI
// only offers actions the API will accept. super_admin passes everything.
const PERMISSIONS = {
  status: ['reviewer', 'conductor', 'tenant_admin'],
  priority: ['reviewer', 'tenant_admin'],
  assign: ['conductor', 'tenant_admin'],
  merge: ['reviewer', 'tenant_admin'],
  comment: ['reviewer', 'conductor', 'community_manager', 'tenant_admin'],
  config: ['tenant_admin'],
  users: ['tenant_admin'],
};

export function can(user, action) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return (PERMISSIONS[action] || []).includes(user.role);
}
