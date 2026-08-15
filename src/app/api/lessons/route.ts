import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { authorizeCourseMaterialTarget, CourseMaterialAccessError } from '@/lib/course-materials-server';
import { jsonBodySize, optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 12_000);
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Lesson creation is unavailable until Supabase is configured.' }, { status: 503 });
    }

    const body = await request.json();
    const courseId = uuid(body.courseId, 'Course');
    const classSectionId = body.classSectionId ? uuid(body.classSectionId, 'Class section') : null;
    const title = requiredText(body.title, 'Lesson title', 180, 3);
    const description = optionalText(body.description, 'Lesson description', 5000);

    let weekNumber: number | null = null;
    if (body.weekNumber !== null && body.weekNumber !== undefined && body.weekNumber !== '') {
      weekNumber = Number(body.weekNumber);
      if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 60) {
        throw new ValidationError('Week number must be between 1 and 60.');
      }
    }

    let scheduledDate: string | null = null;
    if (body.scheduledDate) {
      scheduledDate = requiredText(body.scheduledDate, 'Lesson date', 10, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || Number.isNaN(Date.parse(`${scheduledDate}T00:00:00Z`))) {
        throw new ValidationError('Enter a valid lesson date.');
      }
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to create lessons.' }, { status: 401 });

    const authorization = await authorizeCourseMaterialTarget(user.id, courseId, classSectionId);
    const { data, error } = await (supabase as any)
      .from('lessons')
      .insert({
        course_id: courseId,
        class_section_id: classSectionId,
        title,
        description,
        week_number: weekNumber,
        scheduled_date: scheduledDate,
        published: body.published !== false,
        created_by: user.id
      })
      .select('id')
      .single();

    if (error || !data?.id) {
      console.error('Lesson creation failed', { message: error?.message, userId: user.id, courseId, classSectionId });
      return NextResponse.json({ error: error?.message ?? 'The lesson could not be created.' }, { status: 400 });
    }

    await authorization.admin.from('audit_log').insert({
      actor_id: user.id,
      action: 'lesson.create',
      target_table: 'lessons',
      target_id: data.id,
      new_value: {
        course_id: courseId,
        class_section_id: classSectionId,
        title,
        week_number: weekNumber,
        scheduled_date: scheduledDate,
        published: body.published !== false
      }
    });

    revalidatePath('/lecturer/lessons');
    revalidatePath('/lecturer/courses');
    revalidatePath('/hod');
    revalidatePath(`/student/courses/${courseId}`);

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CourseMaterialAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'The lesson could not be created.' }, { status: 500 });
  }
}
