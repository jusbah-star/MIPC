import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  BookOpenIcon,
  ClockIcon,
  FileTextIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  MegaphoneIcon,
  UsersIcon
} from '@/components/icons';

export default async function StudentCourseRoomPage({
  params
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  let course: any = dataStore.courses.find((c) => c.id === courseId);
  let lecturer: any = dataStore.profiles.find((p) => p.id === course?.lecturer_id);
  let tests: any[] = dataStore.tests.filter((t) => t.course_id === course?.id);
  let assignments: any[] = dataStore.assignments.filter((a) => a.course_id === course?.id);
  let materials: any[] = dataStore.course_materials.filter((item) => item.course_id === course?.id && item.published);
  let announcements: any[] = dataStore.announcements.filter(
    (a) => a.scope === 'course' || a.scope === 'college'
  );
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: courseRow, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseError || !courseRow) notFound();
    course = courseRow as any;
    const [testResult, assignmentResult, announcementResult, lecturerResult, materialResult] = await Promise.all([
      supabase.from('tests').select('*').eq('course_id', courseId).eq('published', true).order('available_from'),
      supabase.from('assignments').select('*').eq('course_id', courseId).order('due_date'),
      supabase.from('announcements').select('*').or(`course_id.eq.${courseId},scope.eq.college`).order('published_at', { ascending: false }),
      supabase.from('profiles').select('full_name, email').eq('id', course.lecturer_id).single(),
      supabase.from('course_materials').select('*').eq('course_id', courseId).eq('published', true).order('created_at', { ascending: false })
    ]);
    const error = testResult.error ?? assignmentResult.error ?? announcementResult.error ?? materialResult.error;
    if (error) throw new Error(error.message);
    tests = (testResult.data ?? []) as any;
    assignments = (assignmentResult.data ?? []) as any;
    announcements = (announcementResult.data ?? []) as any;
    lecturer = lecturerResult.data as any;
    materials = (materialResult.data ?? []) as any;
  }
  if (!course) notFound();

  return (
    <div className="space-y-8">
      {/* Course Room Header */}
      <div className="bg-white rounded-2xl border border-ink-900/10 p-6 sm:p-8 shadow-academic">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-3 py-1 rounded-full">
              {course.code}
            </span>
            <span className="text-xs font-mono text-ink-500 uppercase tracking-wider">
              {course.credits} academic credits · Academic year 2026/2027
            </span>
          </div>
          <Link
            href="/student/courses"
            className="text-xs font-mono text-ink-600 hover:text-ink-950 flex items-center gap-1"
          >
            &larr; All Modules
          </Link>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950">
          {course.title}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-ink-700 leading-relaxed max-w-3xl">
          {course.description}
        </p>

        <div className="mt-6 pt-6 border-t border-parchment-200 flex flex-wrap items-center gap-6 text-xs text-ink-600 font-mono">
          <div>
            <span className="text-ink-400">Course Convenor:</span>{' '}
            <strong className="text-ink-950 font-semibold">{lecturer?.full_name ?? 'Assigned faculty member'}</strong>
          </div>
          <div>
            <span className="text-ink-400">Contact:</span>{' '}
            <span className="text-mipc-green-800 font-medium">{lecturer?.email ?? 'Contact the academic registry'}</span>
          </div>
        </div>
      </div>

      {/* Course Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column: Tests & Coursework */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs" aria-labelledby="course-materials-title">
            <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><BookOpenIcon className="w-5 h-5 text-brass-600" /><h2 id="course-materials-title" className="font-display text-lg font-bold text-ink-950">Course materials</h2></div><span className="text-xs font-mono text-ink-500">{materials.length} published</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{materials.map((material) => <article key={material.id} className="rounded-xl border border-parchment-300 bg-parchment-50/50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-mipc-green-700">{material.material_type}</p><h3 className="mt-1 font-display text-base font-bold text-ink-950">{material.title}</h3>{material.description && <p className="mt-1 text-xs leading-5 text-ink-600">{material.description}</p>}{material.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-700">{material.content}</p>}{material.resource_url && <a href={material.resource_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-mipc-green-700">Open secure resource</a>}</article>)}{materials.length === 0 && <p className="text-sm text-ink-600 sm:col-span-2">No materials have been published for this course.</p>}</div>
          </section>

          {/* Timed Examinations */}
          <div className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-brass-600" />
                <h2 className="font-display text-lg font-bold text-ink-950">
                  Timed Examinations & Assessments
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">{tests.length} scheduled</span>
            </div>

            <div className="space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="p-4 rounded-lg border border-parchment-300 bg-parchment-50/50 flex items-center justify-between hover:bg-parchment-100/60 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-signal-ok font-bold bg-signal-ok-bg px-2 py-0.5 rounded">
                        Active Exam
                      </span>
                      <span className="text-xs font-mono text-ink-500">
                        {test.duration_minutes} Mins · Pass: {(test as any).passing_score ?? 50}%
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-ink-950">
                      {test.title}
                    </h3>
                  </div>
                  <Link
                    href={`/student/tests/${test.id}`}
                    className="rounded-lg bg-brass-500 px-4 py-2 text-xs font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <span>Begin Exam</span>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}

              {tests.length === 0 && (
                <p className="text-xs text-ink-500 py-4 font-mono text-center">
                  No exams currently scheduled for this module.
                </p>
              )}
            </div>
          </div>

          {/* Assignments & Problem Sets */}
          <div className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-5 h-5 text-brass-600" />
                <h2 className="font-display text-lg font-bold text-ink-950">
                  Coursework & Problem Sets
                </h2>
              </div>
              <span className="text-xs font-mono text-ink-500">{assignments.length} assigned</span>
            </div>

            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="p-4 rounded-lg border border-parchment-300 bg-white flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-brass-700 font-semibold">
                        Max {assignment.max_points} Points
                      </span>
                      <span className="text-xs font-mono text-ink-500">
                        Due {new Date(assignment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-ink-950">
                      {assignment.title}
                    </h3>
                    <p className="text-xs text-ink-600 mt-1 line-clamp-1">
                      {assignment.description}
                    </p>
                  </div>
                  <Link
                    href="/student/assignments"
                    className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 transition-colors shrink-0"
                  >
                    View Problem Set
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Module Notices & Resources */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <MegaphoneIcon className="w-5 h-5 text-brass-600" />
              <h2 className="font-display text-base font-bold text-ink-950">
                Module Notices
              </h2>
            </div>
            <div className="space-y-4">
              {announcements.slice(0, 2).map((a) => (
                <div key={a.id} className="pb-3 border-b border-parchment-200 last:border-0 last:pb-0">
                  <span className="text-[10px] font-mono text-ink-500 block mb-1">
                    {new Date(a.published_at).toLocaleDateString('en-GB')}
                  </span>
                  <h4 className="font-display text-sm font-bold text-ink-950 mb-1">
                    {a.title}
                  </h4>
                  <p className="text-xs text-ink-700 line-clamp-3">
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-parchment-100/70 rounded-xl border border-parchment-300 p-6">
            <h3 className="font-display text-sm font-bold text-ink-950 mb-2">
              Academic Support & Office Hours
            </h3>
            <p className="text-xs text-ink-700 leading-relaxed font-mono">
              Contact {lecturer?.full_name ?? 'your assigned lecturer'} at {lecturer?.email ?? 'the academic registry'} for consultation times and learning support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
