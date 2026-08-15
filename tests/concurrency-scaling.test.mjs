import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('exam API rate limits authenticated traffic per student instead of campus IP', () => {
  const answers = read('src/app/api/tests/[testId]/answers/route.ts');
  const submit = read('src/app/api/tests/[testId]/submit/route.ts');
  assert.match(answers, /exam-save:user:\$\{user\.id\}/);
  assert.match(submit, /exam-submit:user:\$\{user\.id\}/);
  assert.doesNotMatch(answers, /exam-save:\$\{clientAddress\(request\)\}/);
  assert.doesNotMatch(submit, /exam-submit:\$\{clientAddress\(request\)\}/);
});

test('exam autosave sends only dirty responses and avoids overlapping saves', () => {
  const runner = read('src/app/(portal)/student/tests/[testId]/test-runner.tsx');
  assert.match(runner, /dirtyQuestionIdsRef/);
  assert.match(runner, /savePromiseRef/);
  assert.match(runner, /15_000/);
  assert.match(runner, /payload = dirtyIds\.map/);
  assert.doesNotMatch(runner, /Object\.entries\(answers\).*\/answers/s);
});

test('database scaling migration uses set-based answer upserts and hot-path indexes', () => {
  const migration = read('supabase/migrations/0030_concurrent_user_scaling.sql');
  assert.match(migration, /upsert_test_answers_internal/);
  assert.match(migration, /insert into public\.answers[\s\S]*select target_attempt_id/);
  assert.match(migration, /questions_test_order_idx/);
  assert.match(migration, /tests_published_course_window_idx/);
  assert.match(migration, /profiles_registered_department_year_class_idx/);
  assert.match(migration, /student_id = \(select auth\.uid\(\)\)/);
});

test('large operational directories are bounded', () => {
  const hodStudents = read('src/app/(portal)/hod/students/page.tsx');
  const registrar = read('src/app/(portal)/registrar/students/page.tsx');
  const adminStudents = read('src/app/(portal)/admin/students/page.tsx');
  const grading = read('src/app/(portal)/lecturer/grading/page.tsx');
  const users = read('src/app/(portal)/admin/users/page.tsx');

  assert.match(hodStudents, /perPage/);
  assert.match(registrar, /PAGE_SIZE = 50/);
  assert.match(adminStudents, /PAGE_SIZE = 50/);
  assert.match(grading, /PAGE_SIZE = 30/);
  assert.match(users, /\.in\('role', \['admin','hod','registrar','finance','lecturer'\]\)/);
});

test('portal auth/profile lookup is memoized per server render', () => {
  const session = read('src/lib/portal-session.ts');
  const layout = read('src/app/(portal)/layout.tsx');
  const governance = read('src/lib/governance-server.ts');
  assert.match(session, /cache\(async \(\) =>/);
  assert.match(layout, /getPortalSession/);
  assert.match(governance, /getPortalSession/);
});
