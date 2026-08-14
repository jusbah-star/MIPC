import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/0023_class_lecturer_rosters.sql', import.meta.url);
const hodPagePath = new URL('../src/app/(portal)/hod/page.tsx', import.meta.url);
const hodActionsPath = new URL('../src/app/(portal)/hod/actions.ts', import.meta.url);

const [migration, hodPage, hodActions] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(hodPagePath, 'utf8'),
  readFile(hodActionsPath, 'utf8')
]);

test('class lecturer roster is distinct from per-lesson responsibility', () => {
  assert.match(migration, /create table if not exists public\.class_section_lecturers/i);
  assert.match(migration, /primary key \(class_section_id, lecturer_id\)/i);
  assert.match(migration, /course_class_assignments/i);
});

test('existing lesson lecturers are backfilled into their class rosters', () => {
  assert.match(migration, /insert into public\.class_section_lecturers\(class_section_id, lecturer_id, assigned_by, assigned_at\)/i);
  assert.match(migration, /from public\.course_class_assignments cca/i);
  assert.match(migration, /on conflict\(class_section_id, lecturer_id\) do nothing/i);
});

test('HOD can assign and remove class lecturers through service-role RPCs', () => {
  assert.match(migration, /function public\.hod_assign_class_lecturer/i);
  assert.match(migration, /function public\.hod_remove_class_lecturer/i);
  assert.match(migration, /grant execute on function public\.hod_assign_class_lecturer\(uuid,uuid,uuid\) to service_role/i);
  assert.match(migration, /grant execute on function public\.hod_remove_class_lecturer\(uuid,uuid,uuid\) to service_role/i);
  assert.match(hodActions, /hod_assign_class_lecturer/);
  assert.match(hodActions, /hod_remove_class_lecturer/);
});

test('lesson assignment requires lecturer membership in the class roster', () => {
  assert.match(migration, /Lecturer must be assigned to this class before being assigned to a lesson/i);
  assert.match(migration, /class_section_lecturers where class_section_id = section\.id and lecturer_id = lecturer\.id/i);
  assert.match(hodPage, /Assign class lecturers to specific lessons/);
  assert.match(hodPage, /classRoster\.map/);
});

test('HOD UI exposes class roster management separately from lesson assignment', () => {
  assert.match(hodPage, /Assign lecturers to classes/);
  assert.match(hodPage, /Assign to class/);
  assert.match(hodPage, /removeClassLecturer/);
  assert.match(hodPage, /Assign lesson/);
});

test('a lecturer with lesson responsibility cannot be removed from the class first', () => {
  assert.match(migration, /Reassign this lecturer lessons before removing them from the class/i);
  assert.match(hodPage, /Reassign this lecturer’s lessons before removing them from the class/i);
});
