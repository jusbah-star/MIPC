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

function refreshStudentRegistry() {
  revalidatePath('/admin/students');
  revalidatePath('/admin/users');
  revalidatePath('/admin/courses');
  revalidatePath('/student/courses');
  revalidatePath('/admin/audit');
  revalidatePath('/admin');
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
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) {
    throw new Error('Year of study is invalid.');
  }

  // Supabase Auth is a separate service from Postgres, so create the identity
  // first and compensate by deleting it if the atomic database transaction fails.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (authError || !authData.user) throw new Error(authError?.message || 'Student account could not be created.');

  const { error: registryError } = await (admin as any).rpc('admin_create_student_profile', {
    target_student_id: authData.user.id,
    student_full_name: fullName,
    student_email: email,
    student_registration_number: registrationNumber,
    target_department_id: departmentId,
    target_cohort_id: cohortId,
    student_year_of_study: yearOfStudy,
    reviewer_id: actor.id
  });

  if (registryError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(authData.user.id);
    if (cleanupError) console.error('Failed to compensate student Auth creation', { userId: authData.user.id, message: cleanupError.message });
    throw new Error(registryError.message);
  }

  refreshStudentRegistry();
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
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) {
    throw new Error('Year of study is invalid.');
  }

  const { data: current, error: currentError } = await (admin as any)
    .from('profiles')
    .select('id, email, role')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();
  if (currentError || !current) throw new Error('Student record could not be found.');

  const previousEmail = String(current.email).trim().toLowerCase();
  const emailChanged = email !== previousEmail;

  if (emailChanged) {
    const { error: authError } = await admin.auth.admin.updateUserById(studentId, { email, email_confirm: true });
    if (authError) throw new Error(authError.message);
  }

  const { error: registryError } = await (admin as any).rpc('admin_update_student', {
    target_student_id: studentId,
    student_full_name: fullName,
    student_email: email,
    student_registration_number: registrationNumber,
    target_department_id: departmentId,
    target_cohort_id: cohortId,
    student_year_of_study: yearOfStudy,
    new_account_status: accountStatus,
    reviewer_id: actor.id
  });

  if (registryError) {
    // Keep Auth and the transactional registry aligned if the database rejects
    // the requested update after the Auth email was already changed.
    if (emailChanged) {
      const { error: revertError } = await admin.auth.admin.updateUserById(studentId, {
        email: previousEmail,
        email_confirm: true
      });
      if (revertError) console.error('Failed to compensate student Auth email update', { studentId, message: revertError.message });
    }
    throw new Error(registryError.message);
  }

  refreshStudentRegistry();
}
