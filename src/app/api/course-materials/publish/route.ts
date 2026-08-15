import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  authorizeCourseMaterialTarget,
  authorizeLessonMaterialTarget,
  COURSE_MATERIAL_BUCKET,
  COURSE_MATERIAL_CATEGORIES,
  CourseMaterialAccessError,
  validateAcademicFile
} from '@/lib/course-materials-server';
import { jsonBodySize, optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';

function materialKind(hasFile: boolean, resourceUrl: string | null, content: string | null) {
  if (hasFile) return 'document';
  if (resourceUrl) return 'link';
  if (content) return 'note';
  return 'document';
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  let cleanupAdmin: Awaited<ReturnType<typeof authorizeCourseMaterialTarget>>['admin'] | null = null;

  try {
    jsonBodySize(request, 40_000);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Academic publishing is unavailable until Supabase is configured.' }, { status: 503 });
    }

    const body = await request.json();
    const lessonId = body.lessonId ? uuid(body.lessonId, 'Lesson') : null;
    const title = requiredText(body.title, 'Material title', 180, 3);
    const description = optionalText(body.description, 'Description', 3000);
    const category = requiredText(body.category, 'Material category', 30);
    if (!COURSE_MATERIAL_CATEGORIES.includes(category as any)) {
      throw new ValidationError('Material category is invalid.');
    }

    const resourceUrl = optionalText(body.resourceUrl, 'Resource URL', 2000);
    const content = optionalText(body.content, 'Material instructions', 20000);
    if (resourceUrl) {
      let parsed: URL;
      try { parsed = new URL(resourceUrl); } catch { throw new ValidationError('Enter a valid HTTPS resource URL.'); }
      if (parsed.protocol !== 'https:') throw new ValidationError('Resource links must use HTTPS.');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to publish lesson materials.' }, { status: 401 });

    let courseId: string;
    let classSectionId: string | null;
    let authorization: Awaited<ReturnType<typeof authorizeCourseMaterialTarget>>;

    if (lessonId) {
      const lessonAuthorization = await authorizeLessonMaterialTarget(user.id, lessonId);
      courseId = lessonAuthorization.lesson.course_id;
      classSectionId = lessonAuthorization.lesson.class_section_id ?? null;
      authorization = lessonAuthorization;
    } else {
      courseId = uuid(body.courseId, 'Course');
      classSectionId = body.classSectionId ? uuid(body.classSectionId, 'Class section') : null;
      authorization = await authorizeCourseMaterialTarget(user.id, courseId, classSectionId);
    }
    cleanupAdmin = authorization.admin;

    const storagePath = optionalText(body.storagePath, 'Storage path', 1000);
    let fileName: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;

    if (storagePath) {
      if (!storagePath.startsWith(`${user.id}/${courseId}/`) || storagePath.includes('../')) {
        throw new ValidationError('Uploaded file path is invalid.');
      }
      const file = validateAcademicFile(body.fileName, body.fileType, body.fileSize);
      fileName = file.fileName;
      fileType = file.fileType;
      fileSize = file.fileSize;
      uploadedPath = storagePath;

      const parts = storagePath.split('/');
      const objectName = parts.pop() ?? '';
      const folder = parts.join('/');
      const { data: objects, error: listError } = await authorization.admin.storage
        .from(COURSE_MATERIAL_BUCKET)
        .list(folder, { search: objectName, limit: 10 });
      if (listError || !objects?.some((item) => item.name === objectName)) {
        throw new ValidationError('The uploaded file could not be verified. Upload it again.');
      }
    }

    if (!storagePath && !resourceUrl && !content) {
      throw new ValidationError('Attach a file, add an HTTPS resource, or enter lesson instructions.');
    }

    const { data, error } = await (authorization.admin as any).rpc('publish_course_material_service_v2', {
      publisher_id: user.id,
      target_lesson_id: lessonId,
      target_course_id: courseId,
      target_class_section_id: classSectionId,
      material_title: title,
      material_description: description,
      material_kind: materialKind(Boolean(storagePath), resourceUrl, content),
      material_category_name: category,
      material_url: resourceUrl,
      material_content: content,
      file_storage_path: storagePath,
      original_file_name: fileName,
      original_file_size: fileSize,
      original_mime_type: fileType,
      publish_now: body.published === true
    });

    if (error) {
      if (uploadedPath && cleanupAdmin) await cleanupAdmin.storage.from(COURSE_MATERIAL_BUCKET).remove([uploadedPath]);
      console.error('Course material publish failed', { message: error.message, userId: user.id, lessonId, courseId, classSectionId });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    revalidatePath('/lecturer/lessons');
    revalidatePath('/lecturer/courses');
    revalidatePath('/hod');
    revalidatePath('/student/courses');
    revalidatePath(`/student/courses/${courseId}`);

    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    if (uploadedPath && cleanupAdmin) {
      await cleanupAdmin.storage.from(COURSE_MATERIAL_BUCKET).remove([uploadedPath]).catch(() => undefined);
    }
    if (error instanceof CourseMaterialAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Academic material could not be published.' }, { status: 500 });
  }
}
