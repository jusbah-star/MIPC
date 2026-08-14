'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findAuthUserByEmail } from '@/lib/supabase/admin-users';
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
  revalidatePath('/admin/courses');
  revalidatePath('/student/courses');
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
  const { error } = await (admin as any).rpc('record_application_approval', {
    target_application_id: applicationId,
    reviewer_id: actor.id
  });
  if (error) throw new Error(error.message);

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
  if (yearOfStudy !== null && (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 8)) {
    throw new Error('Year of study is invalid.');
  }

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await (admin as any)
    .from('applications')
    .select('id, full_name, email, status, enrolled_student_id')
    .eq('id', applicationId)
    .eq('status', 'approved')
    .single();
  if (applicationError || !application) throw new Error('Approved application not found.');
  if (application.enrolled_student_id) throw new Error('This applicant is already enrolled.');

  const email = String(application.email).trim().toLowerCase();
  let studentId: string;
  let createdAuthUser = false;

  const { data: existingProfile, error: existingProfileError } = await (admin as any)
    .from('profiles')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle();
  if (existingProfileError) throw new Error('Existing MIPC account could not be checked.');

  if (existingProfile) {
    if (existingProfile.role !== 'student') throw new Error('This email already belongs to a non-student MIPC account.');
    studentId = existingProfile.id;
  } else {
    const existingAuthUser = await findAuthUserByEmail(admin, email);

    if (existingAuthUser) {
      const { data: linkedProfile, error: linkedProfileError } = await (admin as any)
        .from('profiles')
        .select('id, role, email')
        .eq('id', existingAuthUser.id)
        .maybeSingle();
      if (linkedProfileError) throw new Error('Existing sign-in identity could not be verified.');
      if (linkedProfile) throw new Error('This sign-in identity is already linked to another MIPC profile.');
      studentId = existingAuthUser.id;
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
  }

  const { error: enrollmentError } = await (admin as any).rpc('admin_enroll_application_student', {
    target_application_id: applicationId,
    target_student_id: studentId,
    student_registration_number: registrationNumber,
    target_department_id: departmentId,
    target_cohort_id: cohortId,
    student_year_of_study: yearOfStudy,
    reviewer_id: actor.id
  });

  if (enrollmentError) {
    if (createdAuthUser) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(studentId);
      if (cleanupError) console.error('Failed to compensate applicant Auth creation', { studentId, message: cleanupError.message });
    }
    throw new Error(enrollmentError.message);
  }

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
  const { error } = await admin.rpc('reject_application' as any, {
    target_application_id: applicationId,
    reviewer_id: actor.id
  } as any);
  if (error) throw new Error(error.message);
  refreshAdmissions();
}
