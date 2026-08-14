import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const requestCodeSource = await readFile(join(root, 'src/app/api/auth/request-code/route.ts'), 'utf8');
const sendLinkSource = await readFile(join(root, 'src/app/api/auth/send-link/route.ts'), 'utf8');
const loginPageSource = await readFile(join(root, 'src/app/login/page.tsx'), 'utf8');
const loginSource = await readFile(join(root, 'src/app/login/portal-link-login.tsx'), 'utf8');
const proxySource = await readFile(join(root, 'src/proxy.ts'), 'utf8');

test('student sign-in retains registration-number plus email verification', () => {
  for (const source of [requestCodeSource, sendLinkSource]) {
    assert.match(source, /portal === 'student'/);
    assert.match(source, /registrationNumber/);
    assert.match(source, /\.eq\('registration_number', registrationNumber\)/);
    assert.match(source, /\.eq\('role', 'student'\)/);
  }
});

test('governance staff share one non-enumerating staff login lookup', () => {
  for (const source of [requestCodeSource, sendLinkSource]) {
    assert.match(source, /portal === 'staff'/);
    assert.match(source, /\.in\('role', STAFF_ROLES\)/);
    assert.match(source, /profileCanAccessPortal\(profile, portal\)/);
    assert.match(source, /shouldCreateUser: false/);
  }
});

test('the mounted login UI exposes student, staff and administrator choices', () => {
  assert.match(loginPageSource, /PortalLinkLogin/);
  assert.match(loginSource, /type PortalRole = LoginPortal/);
  assert.match(loginSource, /role: 'student', label: 'Student'/);
  assert.match(loginSource, /role: 'staff', label: 'Staff'/);
  assert.match(loginSource, /role: 'admin', label: 'Administrator'/);
  assert.match(loginSource, /Lecturers, HODs, Registrar and Finance staff/);
  assert.doesNotMatch(loginSource, /role: 'lecturer'/);
});

test('mounted magic-link form sends the shared staff portal key', () => {
  assert.match(loginSource, /JSON\.stringify\(\{ portal, email/);
  assert.match(loginSource, /portal === 'student' \? \{ registrationNumber \} : \{\}/);
  assert.match(loginSource, /fetch\('\/api\/auth\/send-link'/);
});

test('proxy protects every governance workspace and allows only explicit oversight', () => {
  for (const segment of ['student','lecturer','hod','registrar','finance','admin']) assert.match(proxySource, new RegExp(`${segment}: '${segment}'`));
  assert.match(proxySource, /roleCanOpenSegment\(storedRole, portalSegment\)/);
});
