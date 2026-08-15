import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/0029_hod_bulk_class_assignment.sql', import.meta.url);
const actionsPath = new URL('../src/app/(portal)/hod/actions.ts', import.meta.url);
const workspacePath = new URL('../src/app/(portal)/hod/students/page.tsx', import.meta.url);
const managerPath = new URL('../src/components/hod-student-class-manager.tsx', import.meta.url);
const overviewPath = new URL('../src/app/(portal)/hod/page.tsx', import.meta.url);
const navPath = new URL('../src/app/(portal)/portal-nav.tsx', import.meta.url);

const [migration, actions, workspace, manager, overview, nav] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(actionsPath, 'utf8'),
  readFile(workspacePath, 'utf8'),
  readFile(managerPath, 'utf8'),
  readFile(overviewPath, 'utf8'),
  readFile(navPath, 'utf8')
]);

test('bulk class assignment is transactional and service-role only', () => {
  assert.match(migration, /hod_bulk_assign_students_class_section/);
  assert.match(migration, /maximum of 100 students can be assigned at once/i);
  assert.match(migration, /perform public\.hod_assign_student_class_section/i);
  assert.match(migration, /revoke all on function public\.hod_bulk_assign_students_class_section\(uuid\[\],uuid,uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.hod_bulk_assign_students_class_section\(uuid\[\],uuid,uuid\) to service_role/i);
});

test('HOD server action validates selected UUIDs and calls the bulk RPC', () => {
  assert.match(actions, /formData\.getAll\('student_ids'\)/);
  assert.match(actions, /studentIds\.length > 100/);
  assert.match(actions, /hod_bulk_assign_students_class_section/);
  assert.match(actions, /target_student_ids: studentIds/);
  assert.match(actions, /revalidatePath\(path\)/);
});

test('student class workspace uses server-side filters and pagination', () => {
  assert.match(workspace, /select\('id', \{ count: 'exact', head: true \}\)/);
  assert.match(workspace, /\.range\(from, to\)/);
  assert.match(workspace, /rawPerPage === 50 \? 50 : 25/);
  assert.match(workspace, /registration_number\.ilike/);
  assert.match(workspace, /assignment === 'unassigned'/);
  assert.match(workspace, /assignment === 'assigned'/);
});

test('student class manager supports search, select-all, capacity checks and bulk assignment', () => {
  assert.match(manager, /Name or registration number/);
  assert.match(manager, /Select all \$\{students\.length\} visible students/);
  assert.match(manager, /incompatibleCount/);
  assert.match(manager, /capacityExceeded/);
  assert.match(manager, /bulkAssignStudentsClassSection/);
  assert.match(manager, /25/);
  assert.match(manager, /50/);
});

test('HOD overview no longer renders one assignment form per student', () => {
  assert.doesNotMatch(overview, /students\.map\(\(student\).*Assign class/s);
  assert.match(overview, /Open student manager/);
  assert.match(overview, /select\('id,department_id,class_section_id'\)/);
});

test('HOD navigation exposes the dedicated Students & Classes workspace', () => {
  assert.match(nav, /href: '\/hod\/students', label: 'Students & Classes'/);
});
