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
  const admin = createAdminClient();
  const name = required(formData.get('name'), 'Cohort name');
  const departmentId = required(formData.get('department_id'), 'Department', 64);
  const startDate = required(formData.get('start_date'), 'Start date', 10);
  const endDate = optional(formData.get('end_date'), 10);

  const { data: department } = await (admin as any).from('departments').select('id').eq('id', departmentId).maybeSingle();
  if (!department) throw new Error('Department not found.');

  const { data: cohort, error } = await (admin as any).from('cohorts').insert({
    name,
    department_id: departmentId,
    start_date: startDate,
    end_date: endDate
  }).select('id').single();
  if (error || !cohort) throw new Error(error?.message || 'Cohort could not be created.');

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'cohort.create',
    target_table: 'cohorts',
    target_id: cohort.id,
    new_value: { name, department_id: departmentId, start_date: startDate, end_date: endDate }
  });
  refreshAcademicRegistry();
}

export async function createCourse(formData: FormData) {
  const actor = await requireAdmin();
  const admin = createAdminClient();
  const code = required(formData.get('code'), 'Course code', 40).toUpperCase();
  const title = required(formData.get('title'), 'Course title');
  const description = optional(formData.get('description'), 2000);
  const departmentId = required(formData.get('department_id'), 'Department', 64);
  const cohortId = optional(formData.get('cohort_id'), 64);
  const credits = Number(required(formData.get('credits'), 'Credits', 2));
  if (!Number.isInteger(credits) || credits < 1 || credits > 60) throw new Error('Credits must be between 1 and 60.');

  if (cohortId) {
    const { data: cohort, error: cohortError } = await (admin as any).from('cohorts').select('id, department_id').eq('id', cohortId).single();
    if (cohortError || !cohort) throw new Error('Selected cohort was not found.');
    if (cohort.department_id !== departmentId) throw new Error('Selected cohort does not belong to the selected department.');
  }

  const { data: course, error } = await (admin as any).from('courses').insert({
    code,
    title,
    description,
    department_id: departmentId,
    cohort_id: cohortId,
    credits
  }).select('id').single();
  if (error || !course) throw new Error(error?.message || 'Course could not be created.');

  if (cohortId) {
    const { error: syncError } = await (admin as any).rpc('sync_course_cohort_enrollments', {
      target_course_id: course.id,
      reviewer_id: actor.id
    });
    if (syncError) throw new Error(syncError.message);
  }

  await (admin as any).from('audit_log').insert({
    actor_id: actor.id,
    action: 'course.create',
    target_table: 'courses',
    target_id: course.id,
    new_value: { code, title, department_id: departmentId, cohort_id: cohortId, credits }
  });
  refreshAcademicRegistry();
}
