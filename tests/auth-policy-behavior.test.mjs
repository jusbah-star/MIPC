import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERIC_ADMIN_REGISTRATION_MESSAGE,
  GENERIC_SIGN_IN_MESSAGE,
  isPortalRole,
  normalizeEmail,
  normalizeRegistrationNumber,
  portalIdentityKey,
  profileCanAccessPortal,
  profilePortalDestination,
  safePortalNext
} from '../src/lib/auth-policy.js';

test('recognized campus roles are explicit', () => {
  assert.equal(isPortalRole('student'), true);
  assert.equal(isPortalRole('lecturer'), true);
  assert.equal(isPortalRole('admin'), true);
  assert.equal(isPortalRole('staff'), false);
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

test('lecturer rate-limit identities do not accept a student registration dimension', () => {
  assert.equal(portalIdentityKey('lecturer', ' Lecturer@MIPC.AC.RW ', 'ignored'), 'lecturer:lecturer@mipc.ac.rw');
});

test('active profiles enter only their authoritative portal', () => {
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'active' }, 'student'), true);
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'active' }, 'admin'), false);
});

test('suspended profiles cannot enter a portal', () => {
  assert.equal(profileCanAccessPortal({ role: 'student', account_status: 'suspended' }, 'student'), false);
});

test('future unknown account states fail closed', () => {
  assert.equal(profileCanAccessPortal({ role: 'lecturer', account_status: 'pending' }, 'lecturer'), false);
  assert.equal(profileCanAccessPortal({ role: 'admin', account_status: 'locked' }, 'admin'), false);
});

test('missing and unknown-role profiles fail closed', () => {
  assert.equal(profileCanAccessPortal(null, 'student'), false);
  assert.equal(profileCanAccessPortal({ role: 'owner', account_status: 'active' }, 'owner'), false);
});

test('portal destination comes only from an active authoritative profile', () => {
  assert.equal(profilePortalDestination({ role: 'admin', account_status: 'active' }), '/admin');
  assert.equal(profilePortalDestination({ role: 'admin', account_status: 'suspended' }), '/login?error=account_unavailable');
  assert.equal(profilePortalDestination({ role: 'unknown', account_status: 'active' }), '/login?error=account_unavailable');
});

test('safe next keeps navigation inside the authenticated role namespace', () => {
  assert.equal(safePortalNext({ role: 'student', account_status: 'active' }, '/student/courses'), '/student/courses');
  assert.equal(safePortalNext({ role: 'student', account_status: 'active' }, '/admin/users'), '/student');
});

test('inactive users cannot preserve a requested next destination', () => {
  assert.equal(safePortalNext({ role: 'student', account_status: 'suspended' }, '/student/courses'), '/login?error=account_unavailable');
});

test('public auth messages do not disclose identity or invitation existence', () => {
  assert.match(GENERIC_SIGN_IN_MESSAGE, /If those details match an active MIPC account/);
  assert.match(GENERIC_ADMIN_REGISTRATION_MESSAGE, /If that email has an active administrator invitation/);
  assert.doesNotMatch(GENERIC_SIGN_IN_MESSAGE, /not found|does not match|invalid account/i);
  assert.doesNotMatch(GENERIC_ADMIN_REGISTRATION_MESSAGE, /not invited|not approved|unknown/i);
});
