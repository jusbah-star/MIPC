import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  ClockIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  AwardIcon
} from '@/components/icons';

export default async function StudentTestsPage() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';

  let tests = dataStore.tests;
  let attempts = dataStore.test_attempts.filter((a) => a.student_id === studentId);
  let courses = dataStore.courses;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Student authentication required.');
    const [testResult, attemptResult] = await Promise.all([
      supabase.from('tests').select('*').eq('published', true).order('available_from', { ascending: true }),
      supabase.from('test_attempts').select('*').eq('student_id', user.id)
    ]);
    if (testResult.error || attemptResult.error) throw new Error(testResult.error?.message ?? attemptResult.error?.message);
    tests = (testResult.data ?? []) as any;
    attempts = (attemptResult.data ?? []) as any;
    const courseIds = Array.from(new Set(tests.map((test) => test.course_id)));
    if (courseIds.length) {
      const { data: courseRows, error } = await supabase.from('courses').select('*').in('id', courseIds);
      if (error) throw new Error(error.message);
      courses = (courseRows ?? []) as any;
    } else courses = [];
  }

  const attemptByTest = new Map(attempts.map((a) => [a.test_id, a]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-brass-600 font-bold block mb-1">
            Examination Center
          </span>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Timed Examinations & Quizzes
          </h1>
          <p className="mt-1 text-sm text-ink-700">
            Server-timed, auto-graded academic assessments. Duration caps are enforced upon starting.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tests.map((test) => {
          const course = courses.find((c) => c.id === test.course_id);
          const attempt = attemptByTest.get(test.id);
          const now = new Date();
          const isOpen = now >= new Date(test.available_from) && now <= new Date(test.available_until);
          const isCompleted = (attempt?.status as any) === 'submitted' || (attempt?.status as any) === 'graded' || (attempt?.status as any) === 'auto_submitted';
          const isInProgress = (attempt?.status as any) === 'in_progress';

          return (
            <div
              key={test.id}
              className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs hover:border-brass-400/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-2 py-0.5 rounded">
                    {course?.code ?? 'MODULE'}
                  </span>
                  <span className="text-xs font-mono text-ink-500">
                    {course?.title ?? 'Academic Course'}
                  </span>
                  {isOpen ? (
                    <span className="text-[10px] font-mono text-signal-ok bg-signal-ok-bg px-2 py-0.5 rounded font-semibold uppercase">
                      Open for examination
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-ink-500 bg-parchment-200 px-2 py-0.5 rounded font-semibold uppercase">
                      Closed
                    </span>
                  )}
                </div>

                <h2 className="font-display text-xl font-bold text-ink-950">
                  {test.title}
                </h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-ink-600 font-mono">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5 text-brass-600" />
                    <span>Duration: {test.duration_minutes} Minutes</span>
                  </div>
                  <div>
                    <span>Passing Standard: {(test as any).passing_score ?? 50}%</span>
                  </div>
                  <div>
                    <span>
                      Window: {new Date(test.available_from).toLocaleDateString('en-GB')} – {new Date(test.available_until).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isCompleted ? (
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-signal-ok font-mono">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Graded: {attempt?.score ?? 0}%</span>
                    </div>
                    <span className="text-[11px] text-ink-500 font-mono">
                      {(attempt?.score ?? 0) >= ((test as any).passing_score ?? 50) ? 'Passed' : 'Pending Review'}
                    </span>
                  </div>
                ) : isInProgress ? (
                  <Link
                    href={`/student/tests/${test.id}`}
                    className="rounded-lg bg-brass-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-xs flex items-center gap-1.5 animate-pulse"
                  >
                    <span>Resume Attempt</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Link>
                ) : isOpen ? (
                  <Link
                    href={`/student/tests/${test.id}`}
                    className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span>Begin Exam</span>
                    <ChevronRightIcon className="w-4 h-4 text-brass-400" />
                  </Link>
                ) : (
                  <span className="text-xs font-mono text-ink-500 bg-parchment-100 px-3 py-1.5 rounded">
                    Exam Window Closed
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {tests.length === 0 && (
          <div className="bg-white rounded-xl border border-ink-900/10 p-12 text-center text-ink-500">
            No examinations currently scheduled.
          </div>
        )}
      </div>
    </div>
  );
}
