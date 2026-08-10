import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = await readFile(join(root, 'supabase/migrations/0005_production_hardening.sql'), 'utf8');
const rbacMigration = await readFile(join(root, 'supabase/migrations/0006_rbac_platform_completion.sql'), 'utf8');

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
  assert.match(rbacMigration, /lecturers manage their course materials/);
  assert.match(rbacMigration, /account_status = 'active'/);
});

test('privileged RBAC workflows are atomic and narrowly granted', () => {
  assert.match(rbacMigration, /create or replace function admin_update_user/);
  assert.match(rbacMigration, /grant execute on function admin_update_user[\s\S]*to service_role/);
  assert.match(rbacMigration, /create or replace function publish_course_material/);
  assert.match(rbacMigration, /create or replace function publish_global_announcement/);
  assert.match(rbacMigration, /for update/);
});

test('exam and course access paths have supporting indexes', () => {
  assert.match(rbacMigration, /create index if not exists idx_tests_course_published_window/);
  assert.match(rbacMigration, /create index if not exists idx_attempts_test_student_status/);
  assert.match(rbacMigration, /create index if not exists idx_course_materials_course_published/);
});

test('assessment endpoints enforce request-rate boundaries', async () => {
  const endpoints = [
    'src/app/api/attempts/route.ts',
    'src/app/api/attempts/[attemptId]/answers/route.ts',
    'src/app/api/attempts/[attemptId]/submit/route.ts'
  ];
  for (const endpoint of endpoints) {
    const source = await readFile(join(root, endpoint), 'utf8');
    assert.match(source, /rateLimit\(/, endpoint);
    assert.match(source, /status: 429/, endpoint);
  }
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
