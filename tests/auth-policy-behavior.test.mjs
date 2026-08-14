import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERIC_ADMIN_REGISTRATION_MESSAGE,
  GENERIC_SIGN_IN_MESSAGE,
  isAccountRole,
  isPortalRole,
  normalizeEmail,
  normalizeRegistrationNumber,
  portalIdentityKey,
  profileCanAccessPortal,
  profilePortalDestination,
  safePortalNext
} from '../src/lib/auth-policy.js';

test('recognized login portals and account roles are explicit', () => {
  for (const portal of ['student','staff','admin']) assert.equal(isPortalRole(portal), true);
  for (const role of ['student','lecturer','hod','registrar','finance','admin']) assert.equal(isAccountRole(role), true);
  assert.equal(isPortalRole('lecturer'), false);
  assert.equal(isAccountRole('owner'), false);
});

test('email identity normalization is case-insensitive', () => {
  assert.equal(normalizeEmail('  Student@MIPC.AC.RW '), 'student@mipc.ac.rw');
});

test('student registration numbers normalize consistently', () => {
  assert.equal(normalizeRegistrationNumber(' mipc-2026-001 '), 'MIPC-2026-001');
});

test('student rate-limit identities include registration number', () => {
  assert.equal(portalIdentityKey('student', ' Student@MIPC.AC.RW ', ' mipc-2026-001 '), 'student:student@mipc.ac.rw:MIPC-2026-001');
});

test('staff rate-limit identities do not reveal a specific governance role', () => {
  assert.equal(portalIdentityKey('staff', ' Lecturer@MIPC.AC.RW ', 'ignored'), 'staff:lecturer@mipc.ac.rw');
});

test('all staff roles enter through the shared staff portal', () => {
  for (const role of ['lecturer','hod','registrar','finance']) {
    assert.equal(profileCanAccessPortal({ role, account_status: 'active' }, 'staff'), true);
  }
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'active' }, 'staff'), false);
  assert.equal(profileCanAccessPortal({ role: 'admin', account_status: 'active' }, 'staff'), false);
});

test('student and admin profiles enter only their dedicated login portals', () => {
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'active' }, 'student'), true);
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'active' }, 'admin'), false);
  assert.equal(profileCanAccessPortal({ role: 'admin', account_status: 'active' }, 'admin'), true);
});

test('inactive, missing and unknown-role profiles fail closed', () => {
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'suspended' }, 'student'), false);
  assert.equal(profileCanAccessPortal({ role: 'hod', account_status: 'pending' }, 'staff'), false);
  assert.equal(profileCanAccessPortal(null, 'student'), false);
  assert.equal(profileCanAccessPortal({ role: 'owner', account_status: 'active' }, 'staff'), false);
});

test('portal destination comes from the authoritative stored account role', () => {
  assert.equal(profilePortalDestination({ role: 'hod', account_status: 'active' }), '/hod');
  assert.equal(profilePortalDestination({ role: 'registrar', account_status: 'active' }), '/registrar');
  assert.equal(profilePortalDestination({ role: 'finance', account_status: 'active' }), '/finance');
  assert.equal(profilePortalDestination({ role: 'admin', account_status: 'suspended' }), '/login?error=account_unavailable');
});

test('safe next keeps navigation inside the authenticated role namespace', () => {
  assert.equal(safePortalNext({ role: 'student', account_status: 'active' }, '/student/courses'), '/student/courses');
  assert.equal(safePortalNext({ role: 'hod', account_status: 'active' }, '/registrar'), '/hod');
});

test('public auth messages do not disclose identity or invitation existence', () => {
  assert.match(GENERIC_SIGN_IN_MESSAGE, /If those details match an active MIPC account/);
  assert.match(GENERIC_ADMIN_REGISTRATION_MESSAGE, /If that email has an active administrator invitation/);
  assert.doesNotMatch(GENERIC_SIGN_IN_MESSAGE, /not found|does not match|invalid account/i);
  assert.doesNotMatch(GENERIC_ADMIN_REGISTRATION_MESSAGE, /not invited|not approved|unknown/i);
});
