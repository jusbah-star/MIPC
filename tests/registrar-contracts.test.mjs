import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = (path) => readFile(join(root, path), 'utf8');

const migrations = [
  'supabase/migrations/0013_registrar_transactional_workflows.sql',
  'supabase/migrations/0014_registrar_enrollment_source_index.sql'
];

test('migration numbering is unique and registration number precedes student registry indexes', async () => {
  const entries = await import('node:fs/promises').then(({ readdir }) => readdir(join(root, 'supabase/migrations')));
  const numeric = entries.map((name) => name.match(/^(\d+)_/)?.[1]).filter(Boolean);
  assert.equal(new Set(numeric).size, numeric.length);
  const registrationMigration = numeric.indexOf('0011');
  const registryMigration = numeric.indexOf('0012');
  assert.ok(registrationMigration >= 0 && registryMigration >= 0 && registrationMigration < registryMigration);
});

test('registrar database mutations are represented by transactional RPCs', async () => {
  const sql = (await Promise.all(migrations.map(source))).join('\n');
  assert.match(sql, /admin_create_student/);
  assert.match(sql, /admin_update_student/);
  assert.match(sql, /admin_create_course/);
  assert.match(sql, /sync_student_cohort_enrollments/);
  assert.match(sql, /sync_course_cohort_enrollments/);
});

test('cohort enrollment reconciliation tracks automatic enrollment ownership', async () => {
  const sql = await source('supabase/migrations/0013_registrar_transactional_workflows.sql');
  assert.match(sql, /source_cohort_id/);
  assert.match(sql, /status = 'active'/);
  assert.match(sql, /on conflict \(student_id, course_id\)/);
});

test('privileged registrar RPCs are service-role only', async () => {
  const sql = await source('supabase/migrations/0013_registrar_transactional_workflows.sql');
  assert.match(sql, /revoke execute on function public\.admin_create_student/);
  assert.match(sql, /grant execute on function public\.admin_create_student[\s\S]*service_role/);
  assert.match(sql, /grant execute on function public\.admin_update_student[\s\S]*service_role/);
  assert.match(sql, /grant execute on function public\.admin_create_course[\s\S]*service_role/);
});

test('registrar server actions use transactional RPCs instead of multi-step table writes', async () => {
  const adminStudentActions = await source('src/app/(portal)/admin/students/actions.ts');
  const registrarActions = await source('src/app/(portal)/registrar/actions.ts');
  const adminCourseActions = await source('src/app/(portal)/admin/courses/actions.ts');
  const combined = `${adminStudentActions}\n${registrarActions}\n${adminCourseActions}`;
  assert.match(combined, /admin_create_student/);
  assert.match(combined, /admin_update_student/);
  assert.match(combined, /admin_create_course/);
});

test('student provisioning reuses orphaned Supabase Auth identities safely', async () => {
  const helper = await source('src/lib/supabase/admin-users.ts');
  const studentActions = await source('src/app/(portal)/admin/students/actions.ts');
  const admissionActions = await source('src/app/(portal)/admin/applications/actions.ts');

  assert.match(helper, /auth\.admin\.listUsers\(\{ page, perPage: PAGE_SIZE \}\)/);
  assert.match(helper, /user\.email\?\.trim\(\)\.toLowerCase\(\) === normalizedEmail/);
  assert.match(studentActions, /findAuthUserByEmail\(admin, email\)/);
  assert.match(admissionActions, /findAuthUserByEmail\(admin, email\)/);
  assert.match(studentActions, /if \(linkedProfile\.role === 'student'\) redirectToRegistry\('student-exists', linkedProfile\.id\)/);
  assert.match(studentActions, /redirectToRegistry\('email-in-use'\)/);
  assert.match(admissionActions, /if \(linkedProfile\) throw new Error\('This sign-in identity is already linked to another MIPC profile\.'\)/);
});

test('student registry treats expected duplicate submissions as notices instead of fatal errors', async () => {
  const studentActions = await source('src/app/(portal)/admin/students/actions.ts');
  const studentPage = await source('src/app/(portal)/admin/students/page.tsx');

  assert.match(studentActions, /redirectToRegistry\('student-exists', existingProfile\.id\)/);
  assert.match(studentActions, /redirectToRegistry\('registration-in-use'\)/);
  assert.match(studentActions, /redirectToRegistry\('student-created', studentId\)/);
  assert.doesNotMatch(studentActions, /throw new Error\('A student account already exists for this email address\.'\)/);
  assert.match(studentPage, /Student already exists/);
  assert.match(studentPage, /No duplicate was created/);

  // Pagination must not hide the record referenced by a create/duplicate notice.
  assert.match(studentPage, /highlightedStudentId && !rows\.some/);
  assert.match(studentPage, /highlightedResult[\s\S]*\.maybeSingle\(\)/);
  assert.match(studentPage, /open=\{highlightedStudentId===student\.id\}/);
  assert.match(studentPage, /PAGE_SIZE = 50/);
});
