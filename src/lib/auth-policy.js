export const ACCOUNT_ROLES = Object.freeze(['student', 'lecturer', 'hod', 'registrar', 'finance', 'admin']);
export const STAFF_ROLES = Object.freeze(['lecturer', 'hod', 'registrar', 'finance']);
export const PORTAL_ROLES = Object.freeze(['student', 'staff', 'admin']);

export const GENERIC_SIGN_IN_MESSAGE =
  'If those details match an active MIPC account, a secure sign-in link has been sent.';

export const GENERIC_ADMIN_REGISTRATION_MESSAGE =
  'If that email has an active administrator invitation, a secure registration link has been sent.';

export function isAccountRole(value) {
  return ACCOUNT_ROLES.includes(String(value ?? ''));
}

export function isPortalRole(value) {
  return PORTAL_ROLES.includes(String(value ?? ''));
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeRegistrationNumber(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function profileCanAccessPortal(profile, portal) {
  if (!profile || profile.account_status !== 'active' || !isAccountRole(profile.role) || !isPortalRole(portal)) {
    return false;
  }
  if (portal === 'staff') return STAFF_ROLES.includes(profile.role);
  return profile.role === portal;
}

export function profilePortalDestination(profile) {
  if (!profile || profile.account_status !== 'active' || !isAccountRole(profile.role)) {
    return '/login?error=account_unavailable';
  }
  return `/${profile.role}`;
}

export function portalIdentityKey(portal, email, registrationNumber = '') {
  const normalizedPortal = String(portal ?? '').trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  if (normalizedPortal === 'student') {
    return `${normalizedPortal}:${normalizedEmail}:${normalizeRegistrationNumber(registrationNumber)}`;
  }
  return `${normalizedPortal}:${normalizedEmail}`;
}

export function safePortalNext(profile, requestedNext) {
  const fallback = profilePortalDestination(profile);
  if (!profile || profile.account_status !== 'active' || !isAccountRole(profile.role)) return fallback;
  const next = String(requestedNext ?? '');
  const rolePrefix = `/${profile.role}`;
  return next.startsWith(rolePrefix) && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : fallback;
}
