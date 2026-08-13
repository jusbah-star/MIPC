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
  assert.match(requestCodeSource, /String\(profile\.email \|\| ''\)[\s\S]*=== email/);
});

test('staff and administrator OTP requests use email with a server-side role match', () => {
  assert.match(requestCodeSource, /\.eq\('email', email\)[\s\S]*\.eq\('role', portal\)/);
  assert.match(requestCodeSource, /profile\.account_status === 'active'/);
  assert.match(requestCodeSource, /profile\.role === portal/);
  assert.match(requestCodeSource, /shouldCreateUser: false/);
});

test('login UI exposes separate student, staff and administrator portal choices', () => {
  assert.match(loginSource, /role: 'student', label: 'Student'/);
  assert.match(loginSource, /role: 'lecturer', label: 'Staff \/ Lecturer'/);
  assert.match(loginSource, /role: 'admin', label: 'Administrator'/);
  assert.match(loginSource, /portal === 'student' \? \{ registrationNumber \} : \{\}/);
});

test('selected tab is not trusted as the authenticated role', () => {
  assert.match(loginSource, /const role = p\.role as PortalRole/);
  assert.match(loginSource, /if \(role !== portal\)[\s\S]*supabase\.auth\.signOut\(\)/);
  assert.match(loginSource, /next\.startsWith\(`\/\$\{role\}`\)/);
  assert.match(proxySource, /const requiredRole = PORTAL_ROLES\[portalSegment\]/);
  assert.match(proxySource, /\(profile as any\)\.role !== requiredRole/);
});
