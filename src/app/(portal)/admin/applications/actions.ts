'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { rejectApplicationInStore } from '@/lib/data-store';
import { uuid } from '@/lib/validation';

async function assertAdmin() {
  if (!isSupabaseConfigured()) return { id: 'user-admin-1' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).single();
  const p = profile as any;
  if (error || p?.role !== 'admin' || p?.account_status !== 'active') throw new Error('Administrator authorization required.');
  return user;
}

function refreshAdmissions() {
  revalidatePath('/admin/applications');
  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath('/admin/students');
  revalidatePath('/admin/audit');
}

function requiredText(value: FormDataEntryValue | null, label: string, max = 160) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} is too long.`);
  return result;
}

function optionalText(value: FormDataEntryValue | null, max = 160) {
  const result = String(value ?? '').trim();
  if (!result) return null;
  if (result.length > max) throw new Error('A value is too long.');
  return result;
}

export async function approveApplication(rawApplicationId: string) {
  const actor = await assertAdmin();
  if (!isSupabaseConfigured()) {
    throw new Error('Live admissions approval requires the connected database.');
  }

  const applicationId = uuid(rawApplicationId, 'Application');
  const admin = createAdminClient();
  const { data: application, error: applicationError } = await (admin as any)
    .from('applications')
    .select('id, status')
    .eq('id', applicationId)
    .in('status', ['pending', 'under_review'])
    .single();
  if (applicationError || !application) throw new Error('Pending application not found.');

  const { error: approvalError } = await (admin as any)
    .from('applications')
    .update({ status: 'approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId);
  if (approvalError) throw new Error(approvalError.message);

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'application.approve',
    target_table: 'applications',
    target_id: applicationId,
    new_value: { status: 'approved' }
  });
  refreshAdmissions();
}

export async function enrollApprovedApplication(formData: FormData) {
  const actor = await assertAdmin();
  if (!isSupabaseConfigured()) throw new Error('Student enrollment requires the connected database.');

  const applicationId = uuid(requiredText(formData.get('application_id'), 'Application', 64), 'Application');
  const registrationNumber = requiredText(formData.get('registration_number'), 'Registration number', 40).toUpperCase();
  const departmentId = optionalText(formData.get('department_id'), 64);
  const cohortId = optionalText(formData.get('cohort_id'), 64);
  const yearRaw = optionalText(formData.get('year_of_study'), 2);
  const yearOfStudy = yearRaw ? Number(yearRaw) : null;
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) throw new Error('Year of study is invalid.');

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await (admin as any)
    .from('applications')
    .select('id, full_name, email, department_id, status, enrolled_student_id')
    .eq('id', applicationId)
    .eq('status', 'approved')
    .single();
  if (applicationError || !application) throw new Error('Approved application not found.');
  if (application.enrolled_student_id) throw new Error('This applicant is already enrolled.');

  const finalDepartmentId = departmentId || application.department_id || null;
  if (!finalDepartmentId) throw new Error('Department of study is required before enrollment.');

  if (cohortId) {
    const { data: cohort, error: cohortError } = await (admin as any).from('cohorts').select('id, department_id').eq('id', cohortId).single();
    if (cohortError || !cohort) throw new Error('Selected cohort could not be found.');
    if (cohort.department_id !== finalDepartmentId) throw new Error('The selected cohort does not belong to the selected department.');
  }

  const { data: duplicateReg } = await (admin as any).from('profiles').select('id').eq('registration_number', registrationNumber).maybeSingle();
  if (duplicateReg) throw new Error('That registration number is already assigned.');

  const email = String(application.email).trim().toLowerCase();
  let studentId: string;
  let createdAuthUser = false;

  const { data: existingProfile } = await (admin as any).from('profiles').select('id, role').ilike('email', email).maybeSingle();
  if (existingProfile) {
    if (existingProfile.role !== 'student') throw new Error('This email already belongs to a non-student MIPC account.');
    studentId = existingProfile.id;
  } else {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: application.full_name }
    });
    if (authError || !authData.user) throw new Error(authError?.message || 'Student portal account could not be created.');
    studentId = authData.user.id;
    createdAuthUser = true;
  }

  const profilePayload = {
    role: 'student',
    full_name: application.full_name,
    email,
    registration_number: registrationNumber,
    department_id: finalDepartmentId,
    cohort_id: cohortId,
    year_of_study: yearOfStudy,
    account_status: 'active'
  };

  const { error: profileError } = existingProfile
    ? await (admin as any).from('profiles').update(profilePayload).eq('id', studentId)
    : await (admin as any).from('profiles').insert({ id: studentId, ...profilePayload });

  if (profileError) {
    if (createdAuthUser) await admin.auth.admin.deleteUser(studentId).catch(() => undefined);
    throw new Error(profileError.message);
  }

  const enrolledAt = new Date().toISOString();
  const { error: linkError } = await (admin as any)
    .from('applications')
    .update({ enrolled_student_id: studentId, enrolled_at: enrolledAt })
    .eq('id', applicationId)
    .is('enrolled_student_id', null);
  if (linkError) throw new Error(linkError.message);

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'application.enroll_student',
    target_table: 'applications',
    target_id: applicationId,
    new_value: {
      student_id: studentId,
      registration_number: registrationNumber,
      department_id: finalDepartmentId,
      cohort_id: cohortId,
      year_of_study: yearOfStudy,
      enrolled_at: enrolledAt
    }
  });

  refreshAdmissions();
}

export async function rejectApplication(rawApplicationId: string) {
  const actor = await assertAdmin();
  if (!isSupabaseConfigured()) {
    await rejectApplicationInStore(rawApplicationId, actor.id);
    refreshAdmissions();
    return;
  }
  const applicationId = uuid(rawApplicationId, 'Application');
  const admin = createAdminClient();
  const { error } = await admin.rpc('reject_application' as any, { target_application_id: applicationId, reviewer_id: actor.id } as any);
  if (error) throw new Error(error.message);
  refreshAdmissions();
}
