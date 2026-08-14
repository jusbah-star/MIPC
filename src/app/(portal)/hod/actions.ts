'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { requiredText } from '@/lib/validation';

function refreshGovernance() {
  for (const path of ['/hod', '/lecturer', '/lecturer/courses', '/student/courses', '/admin', '/admin/users', '/admin/audit']) revalidatePath(path);
}

export async function assignLecturerDepartment(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const departmentId = requiredText(formData.get('department_id'), 'Department', 64);
  const { error } = await admin.rpc('hod_assign_lecturer_department', { target_lecturer_id: lecturerId, target_department_id: departmentId, reviewer_id: user.id });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function setLecturerStatus(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const status = requiredText(formData.get('account_status'), 'Account status', 20);
  if (!['active', 'suspended'].includes(status)) throw new Error('Invalid lecturer status.');
  const { error } = await admin.rpc('hod_set_lecturer_status', { target_lecturer_id: lecturerId, new_status: status, reviewer_id: user.id });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function assignStudentClass(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const studentId = requiredText(formData.get('student_id'), 'Student', 64);
  const cohortId = requiredText(formData.get('cohort_id'), 'Class / cohort', 64);
  const { error } = await admin.rpc('hod_assign_student_cohort', { target_student_id: studentId, target_cohort_id: cohortId, reviewer_id: user.id });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function assignCourseLecturer(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const courseId = requiredText(formData.get('course_id'), 'Course', 64);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const { error } = await admin.rpc('hod_assign_course_lecturer', { target_course_id: courseId, target_lecturer_id: lecturerId, reviewer_id: user.id });
  if (error) throw new Error(error.message);
  refreshGovernance();
}
