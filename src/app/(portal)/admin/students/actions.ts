'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';

function text(value: FormDataEntryValue | null, label: string, max = 160) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} is too long.`);
  return result;
}

function optional(value: FormDataEntryValue | null, max = 160) {
  const result = String(value ?? '').trim();
  if (!result) return null;
  if (result.length > max) throw new Error('A value is too long.');
  return result;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).single();
  if ((profile as any)?.role !== 'admin' || (profile as any)?.account_status !== 'active') {
    throw new Error('Administrator authorization required.');
  }
  return user;
}

async function validateAcademicAssignment(admin: ReturnType<typeof createAdminClient>, departmentId: string | null, cohortId: string | null) {
  if (!cohortId) return;
  const { data: cohort, error } = await (admin as any).from('cohorts').select('id, department_id').eq('id', cohortId).single();
  if (error || !cohort) throw new Error('Selected cohort could not be found.');
  if (!departmentId || cohort.department_id !== departmentId) {
    throw new Error('The selected cohort does not belong to the selected department.');
  }
}

export async function createStudent(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const fullName = text(formData.get('full_name'), 'Full name');
  const email = text(formData.get('email'), 'Email', 320).toLowerCase();
  const registrationNumber = text(formData.get('registration_number'), 'Registration number', 40).toUpperCase();
  const departmentId = optional(formData.get('department_id'), 64);
  const cohortId = optional(formData.get('cohort_id'), 64);
  const yearRaw = optional(formData.get('year_of_study'), 2);
  const yearOfStudy = yearRaw ? Number(yearRaw) : null;
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) throw new Error('Year of study is invalid.');
  await validateAcademicAssignment(admin, departmentId, cohortId);

  const { data: existingReg } = await (admin as any).from('profiles').select('id').eq('registration_number', registrationNumber).maybeSingle();
  if (existingReg) throw new Error('That registration number is already assigned.');
  const { data: existingEmail } = await (admin as any).from('profiles').select('id').ilike('email', email).maybeSingle();
  if (existingEmail) throw new Error('That email address already belongs to an MIPC account.');

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (authError || !authData.user) throw new Error(authError?.message || 'Student account could not be created.');

  const { error: profileError } = await (admin as any).from('profiles').insert({
    id: authData.user.id,
    role: 'student',
    full_name: fullName,
    email,
    registration_number: registrationNumber,
    department_id: departmentId,
    cohort_id: cohortId,
    year_of_study: yearOfStudy,
    account_status: 'active'
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    throw new Error(profileError.message);
  }

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'student.create',
    target_table: 'profiles',
    target_id: authData.user.id,
    new_value: { full_name: fullName, email, registration_number: registrationNumber, department_id: departmentId, cohort_id: cohortId, year_of_study: yearOfStudy, account_status: 'active' }
  });

  revalidatePath('/admin/students');
  revalidatePath('/admin');
}

export async function updateStudent(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const studentId = text(formData.get('student_id'), 'Student', 64);
  const fullName = text(formData.get('full_name'), 'Full name');
  const email = text(formData.get('email'), 'Email', 320).toLowerCase();
  const registrationNumber = text(formData.get('registration_number'), 'Registration number', 40).toUpperCase();
  const departmentId = optional(formData.get('department_id'), 64);
  const cohortId = optional(formData.get('cohort_id'), 64);
  const yearRaw = optional(formData.get('year_of_study'), 2);
  const yearOfStudy = yearRaw ? Number(yearRaw) : null;
  const accountStatus = text(formData.get('account_status'), 'Account status', 20);
  if (!['active', 'suspended'].includes(accountStatus)) throw new Error('Account status is invalid.');
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) throw new Error('Year of study is invalid.');
  await validateAcademicAssignment(admin, departmentId, cohortId);

  const { data: current, error: currentError } = await (admin as any).from('profiles').select('*').eq('id', studentId).eq('role', 'student').single();
  if (currentError || !current) throw new Error('Student record could not be found.');

  const { data: duplicateReg } = await (admin as any).from('profiles').select('id').eq('registration_number', registrationNumber).neq('id', studentId).maybeSingle();
  if (duplicateReg) throw new Error('That registration number is already assigned.');
  const { data: duplicateEmail } = await (admin as any).from('profiles').select('id').ilike('email', email).neq('id', studentId).maybeSingle();
  if (duplicateEmail) throw new Error('That email address already belongs to another MIPC account.');

  if (email !== String(current.email).toLowerCase()) {
    const { error: authError } = await admin.auth.admin.updateUserById(studentId, { email, email_confirm: true });
    if (authError) throw new Error(authError.message);
  }

  const { error: updateError } = await (admin as any).from('profiles').update({
    full_name: fullName,
    email,
    registration_number: registrationNumber,
    department_id: departmentId,
    cohort_id: cohortId,
    year_of_study: yearOfStudy,
    account_status: accountStatus
  }).eq('id', studentId);
  if (updateError) throw new Error(updateError.message);

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'student.registry.update',
    target_table: 'profiles',
    target_id: studentId,
    old_value: { full_name: current.full_name, email: current.email, registration_number: current.registration_number, department_id: current.department_id, cohort_id: current.cohort_id, year_of_study: current.year_of_study, account_status: current.account_status },
    new_value: { full_name: fullName, email, registration_number: registrationNumber, department_id: departmentId, cohort_id: cohortId, year_of_study: yearOfStudy, account_status: accountStatus }
  });

  revalidatePath('/admin/students');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
}
