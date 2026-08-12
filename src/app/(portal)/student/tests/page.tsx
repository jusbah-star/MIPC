import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { CheckCircleIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';

export default async function StudentTestsPage() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';

  let tests = dataStore.tests;
  let attempts = dataStore.test_attempts.filter((attempt) => attempt.student_id === studentId);
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
    } else {
      courses = [];
    }
  }

  const attemptByTest = new Map(attempts.map((attempt) => [attempt.test_id, attempt]));
  const now = new Date();
  const openCount = tests.filter((test) => now >= new Date(test.available_from) && now <= new Date(test.available_until)).length;
  const completedCount = attempts.filter((attempt) => ['submitted', 'graded', 'auto_submitted'].includes(attempt.status as any)).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Examinations</p>
          <h1 className="mipc-page-title">Assessments & quizzes</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">See what is open, resume an active attempt, and review completed assessment results.</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-xs font-semibold text-mipc-green-700">{openCount} open</span>
          <span className="rounded-full bg-parchment-200 px-3 py-1.5 text-xs font-semibold text-ink-600">{completedCount} completed</span>
        </div>
      </header>

      <section className="grid gap-4">
        {tests.map((test) => {
          const course = courses.find((item) => item.id === test.course_id);
          const attempt = attemptByTest.get(test.id);
          const isOpen = now >= new Date(test.available_from) && now <= new Date(test.available_until);
          const isCompleted = ['submitted', 'graded', 'auto_submitted'].includes((attempt?.status as any) ?? '');
          const isInProgress = (attempt?.status as any) === 'in_progress';
          const passMark = (test as any).passing_score ?? 50;
          const score = Number(attempt?.score ?? 0);

          return (
            <article key={test.id} className="rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs transition hover:border-mipc-green-700/20 hover:shadow-academic sm:p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course?.code ?? 'Course'}</span>
                    <span className="truncate text-xs text-ink-400">{course?.title ?? 'Academic course'}</span>
                    {isOpen && !isCompleted ? <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok"><span className="h-1.5 w-1.5 rounded-full bg-signal-ok" /> Open now</span> : null}
                  </div>

                  <h2 className="mt-4 text-xl font-bold leading-snug tracking-[-0.025em] text-ink-950">{test.title}</h2>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5 text-mipc-green-700" /> {test.duration_minutes} minutes</span>
                    <span>Pass mark {passMark}%</span>
                    <span>{new Date(test.available_from).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })} – {new Date(test.available_until).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isCompleted ? (
                    <div className="min-w-40 rounded-2xl bg-parchment-50 p-4 text-left md:text-right">
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal-ok"><CheckCircleIcon className="h-4 w-4" /> Completed</div>
                      <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink-950">{score}%</p>
                      <p className="mt-0.5 text-xs text-ink-500">{score >= passMark ? 'Pass mark achieved' : 'See lecturer feedback'}</p>
                    </div>
                  ) : isInProgress ? (
                    <Link href={`/student/tests/${test.id}`} className="mipc-button-primary min-w-40">Resume exam <ChevronRightIcon className="h-4 w-4" /></Link>
                  ) : isOpen ? (
                    <Link href={`/student/tests/${test.id}`} className="mipc-button-primary min-w-40">Begin exam <ChevronRightIcon className="h-4 w-4" /></Link>
                  ) : (
                    <span className="inline-flex min-h-10 items-center rounded-xl bg-parchment-100 px-4 text-sm font-medium text-ink-500">Exam window closed</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {tests.length === 0 ? <div className="mipc-empty">No examinations are currently scheduled.</div> : null}
      </section>
    </div>
  );
}
