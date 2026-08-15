import { redirect } from 'next/navigation';
import { AcademicMaterialUploader, type AcademicMaterialTarget } from '@/components/academic-material-uploader';
import { LessonBuilder, type LessonScopeTarget } from '@/components/lesson-builder';
import { BookOpenIcon, FileTextIcon } from '@/components/icons';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';

function scopeKey(courseId: string, classSectionId: string | null | undefined) {
  return `${courseId}:${classSectionId ?? 'whole'}`;
}

export default async function LecturerLessonsPage() {
  if (!isSupabaseConfigured()) {
    return <div className="mipc-empty">Lessons & Materials requires the connected MIPC academic database.</div>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,department_id,account_status')
    .eq('id', user.id)
    .single();
  const profile: any = profileRow;
  if (profileError || !profile || profile.account_status !== 'active') redirect('/login?error=account_unavailable');
  if (!['lecturer', 'hod', 'admin'].includes(profile.role)) redirect(`/${profile.role}`);

  const admin = createAdminClient();
  const [courseResult, sectionResult, assignmentResult, lessonResult] = await Promise.all([
    admin.from('courses').select('id,code,title,department_id,cohort_id,lecturer_id').order('code'),
    (admin as any).from('class_sections').select('id,name,department_id,cohort_id,year_of_study,is_active').eq('is_active', true).order('year_of_study').order('name'),
    (admin as any).from('course_class_assignments').select('course_id,class_section_id,lecturer_id'),
    (admin as any).from('lessons').select('id,course_id,class_section_id,title,description,week_number,scheduled_date,published,created_by,created_at').order('week_number', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  ]);
  const loadError = courseResult.error ?? sectionResult.error ?? assignmentResult.error ?? lessonResult.error;
  if (loadError) throw new Error('Lessons and teaching assignments could not be loaded.');

  const allCourses: any[] = courseResult.data ?? [];
  const sections: any[] = sectionResult.data ?? [];
  const assignments: any[] = assignmentResult.data ?? [];
  const allLessons: any[] = lessonResult.data ?? [];
  const isAdmin = profile.role === 'admin';
  const isHod = profile.role === 'hod';

  const visibleCourses = allCourses.filter((course) => {
    if (isAdmin) return true;
    if (isHod) return course.department_id === profile.department_id;
    return course.lecturer_id === user.id || assignments.some((assignment) => assignment.course_id === course.id && assignment.lecturer_id === user.id);
  });

  const scopeMap = new Map<string, LessonScopeTarget>();
  for (const course of visibleCourses) {
    const isConvenor = course.lecturer_id === user.id;
    if (isAdmin || isConvenor) {
      scopeMap.set(scopeKey(course.id, null), {
        courseId: course.id,
        courseLabel: `${course.code} — ${course.title}`,
        classSectionId: null,
        scopeLabel: 'Whole intake / cohort'
      });
    }

    if (!course.cohort_id) continue;
    for (const section of sections) {
      if (section.department_id !== course.department_id || section.cohort_id !== course.cohort_id) continue;
      const classAssignment = assignments.some((assignment) =>
        assignment.course_id === course.id &&
        assignment.class_section_id === section.id &&
        assignment.lecturer_id === user.id
      );
      const canUseClass = isAdmin || (isHod && course.department_id === profile.department_id) || isConvenor || classAssignment;
      if (!canUseClass) continue;
      scopeMap.set(scopeKey(course.id, section.id), {
        courseId: course.id,
        courseLabel: `${course.code} — ${course.title}`,
        classSectionId: section.id,
        scopeLabel: `${section.name} · Year ${section.year_of_study}`
      });
    }
  }

  const lessonScopes = Array.from(scopeMap.values()).sort((a, b) =>
    `${a.courseLabel}${a.scopeLabel}`.localeCompare(`${b.courseLabel}${b.scopeLabel}`)
  );
  const permittedScopeKeys = new Set(scopeMap.keys());
  const lessons = allLessons.filter((lesson) => permittedScopeKeys.has(scopeKey(lesson.course_id, lesson.class_section_id)));

  const materialTargets: AcademicMaterialTarget[] = lessons.map((lesson) => {
    const course = allCourses.find((item) => item.id === lesson.course_id);
    const section = sections.find((item) => item.id === lesson.class_section_id);
    return {
      lessonId: lesson.id,
      lessonLabel: `${lesson.week_number ? `Week ${lesson.week_number} · ` : ''}${lesson.title}`,
      courseId: lesson.course_id,
      courseLabel: course ? `${course.code} — ${course.title}` : 'Course',
      classSectionId: lesson.class_section_id ?? null,
      scopeLabel: section ? `${section.name} · Year ${section.year_of_study}` : 'Whole intake / cohort'
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="mipc-eyebrow">Teaching content</p>
        <h1 className="mipc-page-title">Lessons & Materials</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-700">
          Build teaching content in the correct order: <strong>Course / module → Lesson / topic → Materials</strong>. Create the topic first, then attach books, lecture notes, questionnaires, assignments, slides, worksheets and other resources to that lesson.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Available course scopes" value={lessonScopes.length} icon={<BookOpenIcon className="h-5 w-5" />} />
        <Metric label="Lessons / topics" value={lessons.length} icon={<BookOpenIcon className="h-5 w-5" />} />
        <Metric label="Upload targets" value={materialTargets.length} icon={<FileTextIcon className="h-5 w-5" />} />
      </div>

      <LessonBuilder targets={lessonScopes} />

      <AcademicMaterialUploader
        targets={materialTargets}
        title="Upload material to a lesson"
        description="Choose an existing lesson/topic, then attach a book, handout, questionnaire, assignment, presentation, worksheet, past paper or reference resource."
        emptyMessage="Create a lesson/topic above first. Materials must be attached to a real lesson rather than directly to an unstructured course screen."
      />

      <section className="mipc-panel overflow-hidden" aria-labelledby="lesson-register-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-parchment-200 p-5">
          <div>
            <h2 id="lesson-register-title" className="font-display text-xl font-bold text-ink-950">Lesson register</h2>
            <p className="mt-1 text-sm text-ink-600">Topics you are permitted to teach or manage.</p>
          </div>
          <span className="mipc-status">{lessons.length} lesson{lessons.length === 1 ? '' : 's'}</span>
        </div>

        <div className="divide-y divide-parchment-200">
          {lessons.map((lesson) => {
            const course = allCourses.find((item) => item.id === lesson.course_id);
            const section = sections.find((item) => item.id === lesson.class_section_id);
            return (
              <article key={lesson.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{course?.code ?? 'Course'}</span>
                    {lesson.week_number && <span className="mipc-status">Week {lesson.week_number}</span>}
                    <span className="mipc-status">{section ? `${section.name} · Year ${section.year_of_study}` : 'Whole intake'}</span>
                    <span className="mipc-status">{lesson.published ? 'Published' : 'Draft'}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold text-ink-950">{lesson.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-ink-500">{course?.title ?? 'Course unavailable'}{lesson.scheduled_date ? ` · Planned ${new Date(`${lesson.scheduled_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : ''}</p>
                  {lesson.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-ink-700">{lesson.description}</p>}
                </div>
                <span className="text-xs text-ink-500">Created {new Date(lesson.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </article>
            );
          })}
          {lessons.length === 0 && (
            <div className="mipc-empty m-5">
              No lessons have been created yet. Use <strong>Add lesson / topic</strong> above. If no course appears there, an administrator must first create and assign a course/module.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="mipc-panel flex items-center gap-4 p-5"><span className="rounded-xl bg-mipc-green-100 p-3 text-mipc-green-800">{icon}</span><div><p className="text-2xl font-bold text-ink-950">{value}</p><p className="text-xs uppercase tracking-wider text-ink-600">{label}</p></div></div>;
}
