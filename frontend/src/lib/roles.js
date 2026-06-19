// Staff roles that may access the admin panel (mirrors the backend STAFF set in admin.routes.js).
export const STAFF_ROLES = ['reviewer', 'conductor', 'community_manager', 'tenant_admin', 'super_admin'];

export const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);
