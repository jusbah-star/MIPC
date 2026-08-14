import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sendLinkSource = await readFile(join(root, 'src/app/api/auth/send-link/route.ts'), 'utf8');
const confirmPageSource = await readFile(join(root, 'src/app/auth/confirm/page.tsx'), 'utf8');
const confirmActionSource = await readFile(join(root, 'src/app/auth/confirm/actions.ts'), 'utf8');
const loginSource = await readFile(join(root, 'src/app/login/portal-link-login.tsx'), 'utf8');

test('new portal magic links target the dedicated confirmation route', () => {
  assert.match(sendLinkSource, /new URL\('\/auth\/confirm', baseUrl\)/);
  assert.match(sendLinkSource, /emailRedirectTo: confirmationUrl/);
  assert.match(sendLinkSource, /shouldCreateUser: false/);
});

test('confirmation GET is scanner-safe and requires an explicit user action', () => {
  assert.match(confirmPageSource, /form action=\{confirmEmailLink\}/);
  assert.match(confirmPageSource, /Continue to MIPC/);
  assert.doesNotMatch(confirmPageSource, /verifyOtp\(/);
});

test('confirmation action verifies token hash server-side and routes from stored profile', () => {
  assert.match(confirmActionSource, /supabase\.auth\.verifyOtp\(/);
  assert.match(confirmActionSource, /token_hash: tokenHash/);
  assert.match(confirmActionSource, /type: 'email'/);
  assert.match(confirmActionSource, /select\('role, account_status'\)/);
  assert.match(confirmActionSource, /profilePortalDestination/);
});

test('expired or consumed links produce a clear recovery message', () => {
  assert.match(loginSource, /email_link_expired/);
  assert.match(loginSource, /expired or was already consumed/);
  assert.match(loginSource, /use the newest message/);
});
