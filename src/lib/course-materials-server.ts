import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';

export const COURSE_MATERIAL_BUCKET = 'course-materials';
export const MAX_COURSE_MATERIAL_FILE_SIZE = 25 * 1024 * 1024;

export const COURSE_MATERIAL_CATEGORIES = [
  'book',
  'handout',
  'questionnaire',
  'assignment',
  'past_paper',
  'presentation',
  'worksheet',
  'reference',
  'other'
] as const;

export type CourseMaterialCategory = (typeof COURSE_MATERIAL_CATEGORIES)[number];

export const COURSE_MATERIAL_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

export class CourseMaterialAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'CourseMaterialAccessError';
    this.status = status;
  }
}

export async function authorizeCourseMaterialTarget(
  userId: string,
  courseId: string,
  classSectionId: string | null
) {
  const admin = createAdminClient();
  const [profileResult, courseResult] = await Promise.all([
    admin.from('profiles').select('id,role,department_id,account_status').eq('id', userId).single(),
    admin.from('courses').select('id,lecturer_id,department_id,cohort_id,code,title').eq('id', courseId).single()
  ]);

  const profile: any = profileResult.data;
  const course: any = courseResult.data;
  if (profileResult.error || !profile || profile.account_status !== 'active') {
    throw new CourseMaterialAccessError('An active staff account is required.', 403);
  }
  if (courseResult.error || !course) {
    throw new CourseMaterialAccessError('Course not found.', 404);
  }

  if (!classSectionId) {
    if (profile.role !== 'admin' && course.lecturer_id !== userId) {
      throw new CourseMaterialAccessError('Only the course convenor can publish to the whole intake.', 403);
    }
    return { admin, profile, course, section: null };
  }

  const { data: section, error: sectionError } = await (admin as any)
    .from('class_sections')
    .select('id,name,department_id,cohort_id,year_of_study,is_active')
    .eq('id', classSectionId)
    .single();

  if (sectionError || !section || !section.is_active) {
    throw new CourseMaterialAccessError('Active class section not found.', 404);
  }
  if (section.department_id !== course.department_id || section.cohort_id !== course.cohort_id) {
    throw new CourseMaterialAccessError('The class and lesson do not belong to the same intake.', 400);
  }

  const isAdmin = profile.role === 'admin';
  const isDepartmentHod = profile.role === 'hod' && profile.department_id === course.department_id;
  const isConvenor = course.lecturer_id === userId;
  let isAssignedClassLecturer = false;

  if (!isAdmin && !isDepartmentHod && !isConvenor) {
    const { data } = await (admin as any)
      .from('course_class_assignments')
      .select('course_id')
      .eq('course_id', courseId)
      .eq('class_section_id', classSectionId)
      .eq('lecturer_id', userId)
      .maybeSingle();
    isAssignedClassLecturer = Boolean(data);
  }

  if (!isAdmin && !isDepartmentHod && !isConvenor && !isAssignedClassLecturer) {
    throw new CourseMaterialAccessError('You are not assigned to this lesson and class.', 403);
  }

  return { admin, profile, course, section };
}

export function validateAcademicFile(fileName: unknown, fileType: unknown, fileSize: unknown) {
  const cleanName = typeof fileName === 'string' ? fileName.trim() : '';
  const cleanType = typeof fileType === 'string' ? fileType.trim().toLowerCase() : '';
  const size = Number(fileSize);

  if (!cleanName || cleanName.length > 255) {
    throw new CourseMaterialAccessError('Choose a valid academic file.', 400);
  }
  const extension = COURSE_MATERIAL_MIME_TO_EXTENSION[cleanType];
  if (!extension) {
    throw new CourseMaterialAccessError('Use PDF, Word, PowerPoint, Excel, TXT, JPG, or PNG files.', 400);
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_COURSE_MATERIAL_FILE_SIZE) {
    throw new CourseMaterialAccessError('Academic files must be 25 MB or smaller.', 400);
  }

  return { fileName: cleanName, fileType: cleanType, fileSize: size, extension };
}

export function buildCourseMaterialStoragePath(userId: string, courseId: string, extension: string) {
  return `${userId}/${courseId}/${randomUUID()}.${extension}`;
}
