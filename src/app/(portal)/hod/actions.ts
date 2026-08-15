'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { requiredText, uuid } from '@/lib/validation';

function refreshGovernance() {
  for (const path of ['/hod', '/hod/students', '/registrar', '/registrar/students', '/registrar/cohorts', '/lecturer', '/lecturer/courses', '/student', '/student/courses', '/admin', '/admin/students', '/admin/courses', '/admin/audit']) revalidatePath(path);
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

export async function createClassSection(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const cohortId = requiredText(formData.get('cohort_id'), 'Cohort / intake', 64);
  const name = requiredText(formData.get('name'), 'Class name', 80);
  const year = Number(requiredText(formData.get('year_of_study'), 'Year of study', 2));
  const capacity = Number(requiredText(formData.get('capacity'), 'Class capacity', 3));
  if (!Number.isInteger(year) || year < 1 || year > 8) throw new Error('Year of study is invalid.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) throw new Error('Class capacity must be between 1 and 500.');
  const { error } = await (admin as any).rpc('hod_create_class_section', {
    target_cohort_id: cohortId,
    section_name: name,
    section_year_of_study: year,
    section_capacity: capacity,
    reviewer_id: user.id
  });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function assignStudentClassSection(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const studentId = requiredText(formData.get('student_id'), 'Student', 64);
  const classSectionId = requiredText(formData.get('class_section_id'), 'Class', 64);
  const { error } = await (admin as any).rpc('hod_assign_student_class_section', {
    target_student_id: studentId,
    target_class_section_id: classSectionId,
    reviewer_id: user.id
  });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function bulkAssignStudentsClassSection(
  _previousState: { status: 'idle' | 'success' | 'error'; message?: string },
  formData: FormData
) {
  try {
    const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
    const classSectionId = uuid(formData.get('class_section_id'), 'Class');
    const studentIds = Array.from(new Set(formData.getAll('student_ids').map((value) => uuid(value, 'Student'))));

    if (studentIds.length === 0) return { status: 'error' as const, message: 'Select at least one student.' };
    if (studentIds.length > 100) return { status: 'error' as const, message: 'Select no more than 100 students at once.' };

    const { data, error } = await (admin as any).rpc('hod_bulk_assign_students_class_section', {
      target_student_ids: studentIds,
      target_class_section_id: classSectionId,
      reviewer_id: user.id
    });
    if (error) return { status: 'error' as const, message: error.message };

    refreshGovernance();
    const count = Number(data ?? studentIds.length);
    return { status: 'success' as const, message: `${count} student${count === 1 ? '' : 's'} assigned successfully.` };
  } catch (error) {
    return { status: 'error' as const, message: error instanceof Error ? error.message : 'Students could not be assigned.' };
  }
}

export async function assignClassLecturer(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const classSectionId = requiredText(formData.get('class_section_id'), 'Class', 64);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const { error } = await (admin as any).rpc('hod_assign_class_lecturer', {
    target_class_section_id: classSectionId,
    target_lecturer_id: lecturerId,
    reviewer_id: user.id
  });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function removeClassLecturer(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const classSectionId = requiredText(formData.get('class_section_id'), 'Class', 64);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const { error } = await (admin as any).rpc('hod_remove_class_lecturer', {
    target_class_section_id: classSectionId,
    target_lecturer_id: lecturerId,
    reviewer_id: user.id
  });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

export async function assignClassCourseLecturer(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const courseId = requiredText(formData.get('course_id'), 'Course', 64);
  const classSectionId = requiredText(formData.get('class_section_id'), 'Class', 64);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const { error } = await (admin as any).rpc('hod_assign_class_course_lecturer', {
    target_course_id: courseId,
    target_class_section_id: classSectionId,
    target_lecturer_id: lecturerId,
    reviewer_id: user.id
  });
  if (error) throw new Error(error.message);
  refreshGovernance();
}

// Retained for cohort-wide legacy course responsibility. Class-specific teaching should use assignClassCourseLecturer.
export async function assignCourseLecturer(formData: FormData) {
  const { user, admin } = await requireActiveGovernanceRole(['hod', 'admin']);
  const courseId = requiredText(formData.get('course_id'), 'Course', 64);
  const lecturerId = requiredText(formData.get('lecturer_id'), 'Lecturer', 64);
  const { error } = await admin.rpc('hod_assign_course_lecturer', { target_course_id: courseId, target_lecturer_id: lecturerId, reviewer_id: user.id });
  if (error) throw new Error(error.message);
  refreshGovernance();
}
