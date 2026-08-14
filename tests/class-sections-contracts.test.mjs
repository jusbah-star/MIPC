import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/0021_class_sections_and_teaching_assignments.sql', import.meta.url);
const rosterMigrationPath = new URL('../supabase/migrations/0022_class_lecturer_roster_scope.sql', import.meta.url);
const hodPagePath = new URL('../src/app/(portal)/hod/page.tsx', import.meta.url);
const hodActionsPath = new URL('../src/app/(portal)/hod/actions.ts', import.meta.url);
const registrarCohortsPath = new URL('../src/app/(portal)/registrar/cohorts/page.tsx', import.meta.url);
const registrarActionsPath = new URL('../src/app/(portal)/registrar/actions.ts', import.meta.url);
const lecturerPagePath = new URL('../src/app/(portal)/lecturer/page.tsx', import.meta.url);
const lecturerCoursesPath = new URL('../src/app/(portal)/lecturer/courses/page.tsx', import.meta.url);

const [migration, rosterMigration, hodPage, hodActions, registrarCohorts, registrarActions, lecturerPage, lecturerCourses] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(rosterMigrationPath, 'utf8'),
  readFile(hodPagePath, 'utf8'),
  readFile(hodActionsPath, 'utf8'),
  readFile(registrarCohortsPath, 'utf8'),
  readFile(registrarActionsPath, 'utf8'),
  readFile(lecturerPagePath, 'utf8'),
  readFile(lecturerCoursesPath, 'utf8')
]);

test('cohort and class are distinct database concepts', () => {
  assert.match(migration, /create table if not exists public\.class_sections/i);
  assert.match(migration, /class_section_id uuid references public\.class_sections/i);
  assert.match(migration, /course_class_assignments/i);
});

test('class assignment enforces department, year, cohort and capacity', () => {
  assert.match(migration, /student\.department_id is distinct from section\.department_id/i);
  assert.match(migration, /student\.year_of_study is distinct from section\.year_of_study/i);
  assert.match(migration, /student\.cohort_id is not null and student\.cohort_id is distinct from section\.cohort_id/i);
  assert.match(migration, /current_size >= section\.capacity/i);
});

test('HOD creates class sections and assigns students and class lessons', () => {
  assert.match(hodActions, /hod_create_class_section/);
  assert.match(hodActions, /hod_assign_student_class_section/);
  assert.match(hodActions, /hod_assign_class_course_lecturer/);
  assert.match(hodPage, /Build classes inside a cohort/);
  assert.match(hodPage, /Assign lecturers to lessons by class/);
});

test('Registrar owns cohort creation', () => {
  assert.match(registrarActions, /registrar_create_cohort/);
  assert.match(registrarCohorts, /Open a new intake/);
  assert.match(registrarCohorts, /Do not create separate cohorts just to split a large class/);
});

test('class teaching assignments remain service-role write operations', () => {
  assert.match(migration, /revoke all on function public\.hod_assign_student_class_section\(uuid,uuid,uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.hod_assign_class_course_lecturer\(uuid,uuid,uuid,uuid\) to service_role/i);
});

test('class lecturer roster access is student-and-class scoped', () => {
  assert.match(rosterMigration, /teaches_student_in_class\(target_course_id uuid, target_student_id uuid\)/i);
  assert.match(rosterMigration, /student\.class_section_id = cca\.class_section_id/i);
  assert.match(rosterMigration, /private\.teaches_course\(course_id\)\s+or private\.teaches_student_in_class\(course_id, student_id\)/i);
});

test('lecturer portal includes HOD class assignments without elevating cohort publishing', () => {
  assert.match(lecturerPage, /course_class_assignments/);
  assert.match(lecturerCourses, /course_class_assignments/);
  assert.match(lecturerCourses, /class-only teaching assignment does not grant permission to publish material to the whole intake/i);
  assert.match(lecturerCourses, /convenedCourses\.map/);
  assert.match(lecturerCourses, /Visible roster/);
});
