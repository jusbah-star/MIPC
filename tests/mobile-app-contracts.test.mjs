import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = (path) => readFile(join(root, path), 'utf8');

test('mobile OTP keeps the existing identity and role checks before code generation', async () => {
  const route = await source('src/app/api/auth/mobile-otp/route.ts');
  assert.match(route, /registrationNumber/);
  assert.match(route, /profileCanAccessPortal/);
  assert.match(route, /STAFF_ROLES/);
  assert.match(route, /getUserById\(profile\.id\)/);
  assert.match(route, /properties\?\.email_otp/);
  assert.match(route, /sendPortalOtpEmail/);
  assert.match(route, /mobile-otp-account/);
});

test('native client verifies OTP itself and enforces the authoritative stored role', async () => {
  const auth = await source('mobile/src/auth.tsx');
  assert.match(auth, /verifyOtp\(\{/);
  assert.match(auth, /type: 'email'/);
  assert.match(auth, /roleMatchesPortal/);
  assert.match(auth, /account_status/);
  assert.match(auth, /supabase\.auth\.signOut/);
});

test('mobile client cannot contain a service-role credential', async () => {
  const files = [
    'mobile/src/lib/supabase.ts',
    'mobile/src/lib/mobile-api.ts',
    'mobile/src/auth.tsx',
    'mobile/.env.example'
  ];
  const combined = (await Promise.all(files.map(source))).join('\n');
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(combined, /EXPO_PUBLIC_SUPABASE_(PUBLISHABLE|ANON)_KEY/);
});

test('mobile app exposes both iOS and Android production identities and verification', async () => {
  const config = JSON.parse(await source('mobile/app.json'));
  const packageJson = JSON.parse(await source('mobile/package.json'));
  assert.equal(config.expo.ios.bundleIdentifier, 'rw.ac.mipc.campus');
  assert.equal(config.expo.android.package, 'rw.ac.mipc.campus');
  assert.match(packageJson.scripts.verify, /expo export --platform ios/);
  assert.match(packageJson.scripts.verify, /expo export --platform android/);
});
