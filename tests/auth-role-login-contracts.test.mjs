import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const requestCodeSource = await readFile(join(root, 'src/app/api/auth/request-code/route.ts'), 'utf8');
const loginSource = await readFile(join(root, 'src/app/login/portal-login.tsx'), 'utf8');
const proxySource = await readFile(join(root, 'src/proxy.ts'), 'utf8');

test('student OTP requests retain registration-number plus email verification', () => {
  assert.match(requestCodeSource, /if \(portal === 'student'\)/);
  assert.match(requestCodeSource, /requiredText\(body\.registrationNumber/);
  assert.match(requestCodeSource, /\.eq\('registration_number', registrationNumber\)/);
  assert.match(requestCodeSource, /\.eq\('role', 'student'\)/);
});

test('governance staff share one non-enumerating staff login lookup', () => {
  assert.match(requestCodeSource, /portal === 'staff'/);
  assert.match(requestCodeSource, /\.in\('role', STAFF_ROLES\)/);
  assert.match(requestCodeSource, /profileCanAccessPortal\(profile, portal\)/);
  assert.match(requestCodeSource, /shouldCreateUser: false/);
});

test('login UI exposes student, staff and administrator choices', () => {
  assert.match(loginSource, /role: 'student', label: 'Student'/);
  assert.match(loginSource, /role: 'staff', label: 'Staff'/);
  assert.match(loginSource, /role: 'admin', label: 'Administrator'/);
  assert.match(loginSource, /portal === 'student' \? \{ registrationNumber \} : \{\}/);
  assert.match(loginSource, /isStaffRole\(role\)/);
});

test('actual stored governance role determines post-login destination', () => {
  assert.match(loginSource, /const actualRole = p\.role as AccountRole/);
  assert.match(loginSource, /roleMatchesPortal\(actualRole, portal\)/);
  assert.match(loginSource, /next\.startsWith\(`\/\$\{actualRole\}`\)/);
});

test('proxy protects every governance workspace and allows only explicit oversight', () => {
  for (const segment of ['student','lecturer','hod','registrar','finance','admin']) assert.match(proxySource, new RegExp(`${segment}: '${segment}'`));
  assert.match(proxySource, /roleCanOpenSegment\(storedRole, portalSegment\)/);
});
