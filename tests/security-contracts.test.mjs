import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = await readFile(join(root, 'supabase/migrations/0005_production_hardening.sql'), 'utf8');
const rbacMigration = await readFile(join(root, 'supabase/migrations/0006_rbac_platform_completion.sql'), 'utf8');
const rateLimitMigration = await readFile(join(root, 'supabase/migrations/0007_distributed_rate_limiting.sql'), 'utf8');
const rpcIsolationMigration = await readFile(join(root, 'supabase/migrations/0009_isolate_privileged_rpcs.sql'), 'utf8');
const rpcAnonRevocationMigration = await readFile(join(root, 'supabase/migrations/0010_revoke_anonymous_rpc_wrappers.sql'), 'utf8');

test('assessment mutations are exposed only through server-owned RPCs', () => {
  assert.match(migration, /create or replace function start_test_attempt/);
  assert.match(migration, /create or replace function save_test_answers/);
  assert.match(migration, /create or replace function submit_test_attempt/);
  assert.match(migration, /revoke all on function submit_test_attempt\(uuid, jsonb\) from public, anon/);
  assert.match(migration, /drop policy if exists "students manage own attempts"/);
  assert.match(migration, /drop policy if exists "students manage own answers while in progress"/);
});

test('grades, admissions decisions and audit events are transactional', () => {
  assert.match(migration, /create or replace function grade_assignment/);
  assert.match(migration, /create or replace function approve_application/);
  assert.match(migration, /create or replace function reject_application/);
  assert.match(migration, /drop policy if exists "authenticated users can write audit entries"/);
  assert.match(migration, /grant execute on function approve_application[\s\S]*to service_role/);
});

test('privacy rights workflow and consent evidence exist', () => {
  assert.match(migration, /create table data_subject_requests/);
  assert.match(migration, /privacy_consent_at/);
  assert.match(migration, /data_request_type.*access.*rectification.*restriction.*erasure.*portability.*objection/s);
});

test('active accounts and course materials are protected by database policies', () => {
  assert.match(rbacMigration, /create type account_status as enum \('active', 'suspended'\)/);
  assert.match(rbacMigration, /create table course_materials/);
  assert.match(rbacMigration, /alter table course_materials enable row level security/);
  assert.match(rbacMigration, /students read published course materials/);
  assert.match(rbacMigration, /lecturers manage course materials/);
  assert.match(rbacMigration, /account_status = 'active'/);
});

test('privileged RBAC workflows are atomic and narrowly granted', () => {
  assert.match(rbacMigration, /create or replace function admin_update_user/);
  assert.match(rbacMigration, /grant execute on function admin_update_user[\s\S]*to service_role/);
  assert.match(rbacMigration, /create or replace function publish_course_material/);
  assert.match(rbacMigration, /create or replace function publish_global_announcement/);
  assert.match(rbacMigration, /for update/);
});

test('privileged authenticated RPC implementations are isolated from the Data API', () => {
  for (const signature of [
    'auth_role\\(\\)',
    'is_enrolled\\(uuid\\)',
    'teaches_course\\(uuid\\)',
    'create_test_with_questions\\(jsonb\\)',
    'get_student_questions\\(uuid\\)',
    'grade_assignment\\(uuid, numeric, text\\)',
    'save_test_answers\\(uuid, jsonb\\)',
    'start_test_attempt\\(uuid\\)',
    'submit_assignment\\(uuid, text\\)',
    'submit_test_attempt\\(uuid, jsonb\\)'
  ]) {
    assert.match(rpcIsolationMigration, new RegExp(`alter function public\\.${signature} set schema private`));
  }
  assert.match(rpcIsolationMigration, /security invoker/);
  assert.match(rpcIsolationMigration, /revoke all on schema private from PUBLIC, anon/);
  assert.match(rpcIsolationMigration, /alter default privileges in schema public revoke execute on functions from PUBLIC, anon, authenticated/);
  assert.match(rpcIsolationMigration, /alter policy "courses readable by authenticated users" on public\.courses to authenticated using \(true\)/);
  assert.match(rpcIsolationMigration, /alter policy "public announcements readable by anyone" on public\.announcements to anon, authenticated/);
});

test('public RPC wrappers explicitly deny anonymous execution', () => {
  for (const signature of [
    'auth_role\\(\\)',
    'is_enrolled\\(uuid\\)',
    'teaches_course\\(uuid\\)',
    'create_test_with_questions\\(jsonb\\)',
    'get_student_questions\\(uuid\\)',
    'grade_assignment\\(uuid, numeric, text\\)',
    'save_test_answers\\(uuid, jsonb\\)',
    'start_test_attempt\\(uuid\\)',
    'submit_assignment\\(uuid, text\\)',
    'submit_test_attempt\\(uuid, jsonb\\)'
  ]) {
    assert.match(
      rpcAnonRevocationMigration,
      new RegExp(`revoke execute on function public\\.${signature} from PUBLIC, anon`)
    );
  }
  assert.match(rpcAnonRevocationMigration, /grant execute on function public\.auth_role\(\) to authenticated, service_role/);
});

test('exam and course access paths have supporting indexes', () => {
  assert.match(rbacMigration, /create index if not exists idx_tests_course_published_window/);
  assert.match(rbacMigration, /create index if not exists idx_attempts_test_student_status/);
  assert.match(rbacMigration, /create index if not exists idx_materials_course_published_created/);
});

test('assessment endpoints enforce request-rate boundaries', async () => {
  const endpoints = [
    'src/app/api/tests/[testId]/attempt/route.ts',
    'src/app/api/tests/[testId]/answers/route.ts',
    'src/app/api/tests/[testId]/submit/route.ts'
  ];
  for (const endpoint of endpoints) {
    const source = await readFile(join(root, endpoint), 'utf8');
    assert.match(source, /await\s+enforceRateLimit\(/, endpoint);
    assert.match(source, /status: 429/, endpoint);
    assert.match(source, /status: 503/, endpoint);
  }
});

test('live rate limiting is shared, hashed and service-role only', async () => {
  const source = await readFile(join(root, 'src/lib/rate-limit.ts'), 'utf8');
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /rpc\('consume_rate_limit'/);
  assert.match(source, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(rateLimitMigration, /create table if not exists public\.rate_limit_buckets/);
  assert.match(rateLimitMigration, /alter table public\.rate_limit_buckets enable row level security/);
  assert.match(rateLimitMigration, /revoke all on table public\.rate_limit_buckets from public, anon, authenticated/);
  assert.match(rateLimitMigration, /grant select, insert, update, delete on table public\.rate_limit_buckets to service_role/);
  assert.match(rateLimitMigration, /security invoker/);
  assert.match(rateLimitMigration, /grant execute on function public\.consume_rate_limit[\s\S]*to service_role/);
});

test('production portal cannot silently fall back to demonstration roles', async () => {
  const serverSource = await readFile(join(root, 'src/lib/supabase/server.ts'), 'utf8');
  const middlewareSource = await readFile(join(root, 'src/lib/supabase/middleware.ts'), 'utf8');
  const proxySource = await readFile(join(root, 'src/proxy.ts'), 'utf8');
  assert.match(serverSource, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(serverSource, /NEXT_PUBLIC_MIPC_DEMO_MODE === 'true'/);
  assert.match(middlewareSource, /demoEnabled/);
  assert.match(proxySource, /if \(!demoEnabled\) return backendUnavailable\(\)/);
  assert.match(proxySource, /status: 503/);
});

test('global response headers include an enforced CSP', async () => {
  const source = await readFile(join(root, 'next.config.mjs'), 'utf8');
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /https:\/\/\*\.supabase\.co/);
});

test('platform-specific SWC binary is not a direct application dependency', async () => {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.dependencies?.['@next/swc-win32-x64-msvc'], undefined);
});

test('client components never import the server-only demonstration store', async () => {
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(path);
    }
    return files;
  }
  for (const file of await walk(join(root, 'src'))) {
    const source = await readFile(file, 'utf8');
    if (/^['"]use client['"];?/m.test(source)) {
      assert.doesNotMatch(source, /(?:from|require\()['"]@\/lib\/data-store/, file);
    }
  }
});
