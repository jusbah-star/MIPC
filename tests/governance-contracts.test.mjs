import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root=process.cwd();
const source=(path)=>readFile(join(root,path),'utf8');
const roles=await source('src/lib/roles.ts');
const proxy=await source('src/proxy.ts');
const governance=await source('supabase/migrations/0017_department_governance_and_finance.sql');
const faculty=await source('supabase/migrations/0018_hod_faculty_permissions.sql');

test('governance roles and oversight boundaries are explicit',()=>{
  for(const role of ['student','lecturer','hod','registrar','finance','admin']) assert.match(roles,new RegExp(`'${role}'`));
  assert.match(roles,/role === 'hod' && segment === 'lecturer'/);
  assert.match(roles,/role === 'admin'.*\['hod', 'registrar', 'finance'\]/s);
  assert.match(proxy,/roleCanOpenSegment\(storedRole, portalSegment\)/);
});

test('HOD workflows are department-scoped and service-role only',()=>{
  for(const fn of ['hod_assign_lecturer_department','hod_set_lecturer_status','hod_assign_student_cohort','hod_assign_course_lecturer']){
    assert.match(governance,new RegExp(`create or replace function public\\.${fn}`));
    assert.match(governance,new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public,anon,authenticated`));
  }
  assert.match(governance,/Only registered students can be assigned to classes/);
  assert.match(governance,/HODs may assign classes only in their own department/);
  assert.match(governance,/Lecturer and course must belong to the same department/);
});

test('Registrar owns registration without class placement',()=>{
  assert.match(governance,/role in \('registrar','admin'\)/);
  assert.match(governance,/registrar_enroll_application_student/);
  assert.match(governance,/registrar_update_student_registration/);
  const registrarActions=await source('src/app/(portal)/registrar/actions.ts');
  assert.match(registrarActions,/registrar_enroll_application_student/);
  assert.match(registrarActions,/registrar_update_student_registration/);
  assert.doesNotMatch(registrarActions,/hod_assign_student_cohort/);
});

test('Finance records are RLS protected and mutations are service-role only',()=>{
  assert.match(governance,/create table if not exists public\.student_finance_accounts/);
  assert.match(governance,/create table if not exists public\.student_payments/);
  assert.match(governance,/students read own finance account/);
  assert.match(governance,/students read own payments/);
  assert.match(governance,/finance_set_student_account/);
  assert.match(governance,/finance_record_student_payment/);
  assert.match(governance,/grant execute on function public\.finance_set_student_account[\s\S]*to service_role/);
});

test('Principal alone provisions governance staff identities',async()=>{
  const actions=await source('src/app/(portal)/admin/users/actions.ts');
  assert.match(actions,/createStaffMember/);
  assert.match(actions,/admin_create_staff_member/);
  assert.match(actions,/\['lecturer','hod','registrar','finance'\]/);
  assert.match(actions,/role!=='admin'/);
});

test('HOD retains assigned faculty teaching permissions',()=>{
  assert.match(faculty,/auth_role\(\) not in \('lecturer','hod'\)/);
  assert.match(faculty,/caller_role not in \('lecturer','hod','admin'\)/);
  assert.match(faculty,/faculty read profiles of their students/);
});
