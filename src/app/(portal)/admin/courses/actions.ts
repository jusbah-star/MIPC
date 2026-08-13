'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';

function required(value: FormDataEntryValue | null, label: string, max = 180) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} is too long.`);
  return result;
}

function optional(value: FormDataEntryValue | null, max = 2000) {
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

function refreshAcademicRegistry() {
  revalidatePath('/admin/courses');
  revalidatePath('/admin/students');
  revalidatePath('/student/courses');
  revalidatePath('/lecturer/courses');
  revalidatePath('/admin/audit');
}

export async function createCohort(formData: FormData) {
  const actor = await requireAdmin();
  const name = required(formData.get('name'), 'Cohort name');
  const departmentId = required(formData.get('department_id'), 'Department', 64);
  const startDate = required(formData.get('start_date'), 'Start date', 10);
  const endDate = optional(formData.get('end_date'), 10);

  const admin = createAdminClient();
  const { error } = await (admin as any).rpc('admin_create_cohort', {
    cohort_name: name,
    target_department_id: departmentId,
    cohort_start_date: startDate,
    cohort_end_date: endDate,
    reviewer_id: actor.id
  });
  if (error) throw new Error(error.message);

  refreshAcademicRegistry();
}

export async function createCourse(formData: FormData) {
  const actor = await requireAdmin();
  const code = required(formData.get('code'), 'Course code', 40).toUpperCase();
  const title = required(formData.get('title'), 'Course title');
  const description = optional(formData.get('description'), 2000);
  const departmentId = required(formData.get('department_id'), 'Department', 64);
  const cohortId = optional(formData.get('cohort_id'), 64);
  const credits = Number(required(formData.get('credits'), 'Credits', 2));
  if (!Number.isInteger(credits) || credits < 1 || credits > 60) throw new Error('Credits must be between 1 and 60.');

  const admin = createAdminClient();
  const { error } = await (admin as any).rpc('admin_create_course', {
    course_code: code,
    course_title: title,
    course_description: description,
    target_department_id: departmentId,
    target_cohort_id: cohortId,
    course_credits: credits,
    reviewer_id: actor.id
  });
  if (error) throw new Error(error.message);

  refreshAcademicRegistry();
}
