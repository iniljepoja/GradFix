// MVP admin roles: Main Admin manages the platform; Tenant Admin manages one city.
export const STAFF_ROLES = ['tenant_admin', 'super_admin'];

export const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);
export const isCitizen = (user) => user?.role === 'citizen';
export const homeForRole = (user) => (isStaff(user) ? '/admin' : '/dashboard');

// Per-action permissions mirror the simplified MVP backend: Tenant Admin owns city operations;
// Main Admin is platform-only and does not pass tenant-operation checks.
const PERMISSIONS = {
  status: ['tenant_admin'],
  priority: ['tenant_admin'],
  assign: ['tenant_admin'],
  workOrder: ['tenant_admin'],
  merge: ['tenant_admin'],
  comment: ['tenant_admin'],
  config: ['tenant_admin'],
  users: ['tenant_admin'],
  platform: ['super_admin'],
};

export function can(user, action) {
  if (!user) return false;
  return (PERMISSIONS[action] || []).includes(user.role);
}
