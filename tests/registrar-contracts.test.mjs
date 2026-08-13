import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationPath = join(root, 'supabase/migrations/0013_registrar_transactional_workflows.sql');
const migration = await readFile(migrationPath, 'utf8');

async function source(path) {
  return readFile(join(root, path), 'utf8');
}

test('migration numbering is unique and registration number precedes student registry indexes', async () => {
  const files = (await readdir(join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const numericPrefixes = files
    .map((name) => name.match(/^(\d+)_/)?.[1])
    .filter(Boolean);
  assert.equal(new Set(numericPrefixes).size, numericPrefixes.length, 'migration numeric prefixes must be unique');

  const registrationIndex = files.indexOf('0011_registration_number_login.sql');
  const registryIndex = files.indexOf('0012_student_registry_year_of_study.sql');
  const registrarIndex = files.indexOf('0013_registrar_transactional_workflows.sql');
  assert.ok(registrationIndex >= 0 && registryIndex > registrationIndex && registrarIndex > registryIndex);
});

test('registrar database mutations are represented by transactional RPCs', () => {
  for (const functionName of [
    'record_application_approval',
    'admin_create_cohort',
    'admin_create_course',
    'admin_create_student_profile',
    'admin_update_student',
    'admin_enroll_application_student'
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\(`));
  }

  assert.match(migration, /perform public\.sync_course_cohort_enrollments\(created_id, reviewer_id\)/);
  assert.match(migration, /perform public\.sync_student_cohort_enrollments\(target_student_id, reviewer_id\)/);
  assert.match(migration, /insert into public\.audit_log/);
});

test('cohort enrollment reconciliation tracks automatic enrollment ownership', () => {
  assert.match(migration, /managed_by_cohort boolean not null default false/);
  assert.match(migration, /source_cohort_id uuid references public\.cohorts/);
  assert.match(migration, /set status = 'dropped'/);
  assert.match(migration, /e\.source_cohort_id is distinct from target_cohort_id/);
  assert.match(migration, /when public\.enrollments\.status = 'completed'/);
});

test('privileged registrar RPCs are service-role only', () => {
  for (const signature of [
    'sync_student_cohort_enrollments\\(uuid, uuid\\)',
    'sync_course_cohort_enrollments\\(uuid, uuid\\)',
    'record_application_approval\\(uuid, uuid\\)',
    'admin_create_cohort\\(text, uuid, date, date, uuid\\)',
    'admin_create_course\\(text, text, text, uuid, uuid, integer, uuid\\)',
    'admin_create_student_profile\\(uuid, text, text, text, uuid, uuid, smallint, uuid\\)',
    'admin_update_student\\(uuid, text, text, text, uuid, uuid, smallint, public\\.account_status, uuid\\)',
    'admin_enroll_application_student\\(uuid, uuid, text, uuid, uuid, smallint, uuid\\)'
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role`));
  }
});

test('registrar server actions use transactional RPCs instead of multi-step table writes', async () => {
  const courseActions = await source('src/app/(portal)/admin/courses/actions.ts');
  const studentActions = await source('src/app/(portal)/admin/students/actions.ts');
  const admissionActions = await source('src/app/(portal)/admin/applications/actions.ts');

  assert.match(courseActions, /rpc\('admin_create_cohort'/);
  assert.match(courseActions, /rpc\('admin_create_course'/);
  assert.doesNotMatch(courseActions, /from\('courses'\)\.insert/);
  assert.doesNotMatch(courseActions, /from\('cohorts'\)\.insert/);

  assert.match(studentActions, /rpc\('admin_create_student_profile'/);
  assert.match(studentActions, /rpc\('admin_update_student'/);
  assert.match(studentActions, /deleteUser\(authData\.user\.id\)/);
  assert.match(studentActions, /Failed to compensate student Auth email update/);

  assert.match(admissionActions, /rpc\('record_application_approval'/);
  assert.match(admissionActions, /rpc\('admin_enroll_application_student'/);
  assert.match(admissionActions, /deleteUser\(studentId\)/);
  assert.doesNotMatch(admissionActions, /from\('applications'\)\s*\.update\(\{ status: 'approved'/);
});
