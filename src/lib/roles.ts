export const ACCOUNT_ROLES = ['student', 'lecturer', 'hod', 'registrar', 'finance', 'admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const STAFF_ROLES = ['lecturer', 'hod', 'registrar', 'finance'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const LOGIN_PORTALS = ['student', 'staff', 'admin'] as const;
export type LoginPortal = (typeof LOGIN_PORTALS)[number];

export function isAccountRole(value: unknown): value is AccountRole {
  return ACCOUNT_ROLES.includes(String(value ?? '') as AccountRole);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return STAFF_ROLES.includes(String(value ?? '') as StaffRole);
}

export function roleCanOpenSegment(role: AccountRole, segment: string) {
  if (role === segment) return true;
  if (role === 'hod' && segment === 'lecturer') return true;
  if (role === 'admin' && ['hod', 'registrar', 'finance'].includes(segment)) return true;
  return false;
}
