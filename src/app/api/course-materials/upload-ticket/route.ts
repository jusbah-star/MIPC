import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  authorizeCourseMaterialTarget,
  authorizeLessonMaterialTarget,
  buildCourseMaterialStoragePath,
  COURSE_MATERIAL_BUCKET,
  CourseMaterialAccessError,
  validateAcademicFile
} from '@/lib/course-materials-server';
import { jsonBodySize, uuid, ValidationError } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 6_000);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Academic file upload is unavailable until Supabase is configured.' }, { status: 503 });
    }

    const body = await request.json();
    const lessonId = body.lessonId ? uuid(body.lessonId, 'Lesson') : null;
    const file = validateAcademicFile(body.fileName, body.fileType, body.fileSize);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to upload lesson materials.' }, { status: 401 });

    let courseId: string;
    let classSectionId: string | null;
    let admin: Awaited<ReturnType<typeof authorizeCourseMaterialTarget>>['admin'];

    if (lessonId) {
      const authorization = await authorizeLessonMaterialTarget(user.id, lessonId);
      courseId = authorization.lesson.course_id;
      classSectionId = authorization.lesson.class_section_id ?? null;
      admin = authorization.admin;
    } else {
      courseId = uuid(body.courseId, 'Course');
      classSectionId = body.classSectionId ? uuid(body.classSectionId, 'Class section') : null;
      const authorization = await authorizeCourseMaterialTarget(user.id, courseId, classSectionId);
      admin = authorization.admin;
    }

    const path = buildCourseMaterialStoragePath(user.id, courseId, file.extension);
    const { data, error } = await admin.storage.from(COURSE_MATERIAL_BUCKET).createSignedUploadUrl(path);

    if (error || !data?.token || !data?.signedUrl) {
      console.error('Course material upload ticket failed', { message: error?.message, userId: user.id, lessonId, courseId, classSectionId });
      return NextResponse.json({ error: 'We could not prepare the academic file upload.' }, { status: 503 });
    }

    return NextResponse.json({
      bucket: COURSE_MATERIAL_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      lessonId,
      courseId,
      classSectionId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize
    }, { status: 201 });
  } catch (error) {
    if (error instanceof CourseMaterialAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Academic file upload could not be prepared.' }, { status: 500 });
  }
}
