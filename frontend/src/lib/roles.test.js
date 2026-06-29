import { describe, it, expect } from 'vitest';
import { STAFF_ROLES, isStaff, isCitizen, homeForRole, can } from './roles.js';

describe('STAFF_ROLES', () => {
  it('contains only the simplified MVP staff roles', () => {
    expect(STAFF_ROLES).toEqual(['tenant_admin', 'super_admin']);
  });
});

describe('isStaff', () => {
  it('is true for tenant_admin and super_admin', () => {
    expect(isStaff({ role: 'tenant_admin' })).toBe(true);
    expect(isStaff({ role: 'super_admin' })).toBe(true);
  });
  it('is false for citizen and non-staff', () => {
    expect(isStaff({ role: 'citizen' })).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
});

describe('isCitizen', () => {
  it('is true only for citizen', () => {
    expect(isCitizen({ role: 'citizen' })).toBe(true);
    expect(isCitizen({ role: 'tenant_admin' })).toBe(false);
    expect(isCitizen(null)).toBe(false);
  });
});

describe('homeForRole', () => {
  it('routes staff to /admin', () => {
    expect(homeForRole({ role: 'tenant_admin' })).toBe('/admin');
    expect(homeForRole({ role: 'super_admin' })).toBe('/admin');
  });
  it('routes citizens and unknowns to /dashboard', () => {
    expect(homeForRole({ role: 'citizen' })).toBe('/dashboard');
    expect(homeForRole(null)).toBe('/dashboard');
  });
});

describe('can', () => {
  it('returns false for a null user', () => {
    expect(can(null, 'status')).toBe(false);
  });
  it('grants tenant_admin all city operations but not platform', () => {
    for (const action of ['status', 'priority', 'assign', 'workOrder', 'merge', 'comment', 'config', 'users']) {
      expect(can({ role: 'tenant_admin' }, action)).toBe(true);
    }
    expect(can({ role: 'tenant_admin' }, 'platform')).toBe(false);
  });
  it('grants super_admin only platform, not city operations', () => {
    expect(can({ role: 'super_admin' }, 'platform')).toBe(true);
    for (const action of ['status', 'priority', 'assign', 'workOrder', 'merge', 'comment', 'config', 'users']) {
      expect(can({ role: 'super_admin' }, action)).toBe(false);
    }
  });
  it('denies citizens everything', () => {
    for (const action of ['status', 'platform', 'config']) {
      expect(can({ role: 'citizen' }, action)).toBe(false);
    }
  });
  it('returns false for an unknown action', () => {
    expect(can({ role: 'tenant_admin' }, 'nope')).toBe(false);
  });
});
