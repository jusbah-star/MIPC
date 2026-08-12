import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  AwardIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon
} from '@/components/icons';

export default async function StudentDashboard() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';
  let displayName = currentStudent?.full_name ?? 'MIPC student';

  let enrollments = dataStore.enrollments.filter((item) => item.student_id === studentId);
  let courses = dataStore.courses.filter((course) => enrollments.some((item) => item.course_id === course.id));
  let tests = dataStore.tests.filter((test) => courses.some((course) => course.id === test.course_id));
  let attempts = dataStore.test_attempts.filter((attempt) => attempt.student_id === studentId);
  let assignments = dataStore.assignments.filter((assignment) => courses.some((course) => course.id === assignment.course_id));
  let submissions = dataStore.submissions.filter((submission) => submission.student_id === studentId);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Student authentication required.');

    const [{ data: profile, error: profileError }, { data: dbEnrollments, error: enrollmentError }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('enrollments').select('*').eq('student_id', user.id).eq('status', 'active')
    ]);

    if (profileError || enrollmentError) throw new Error(profileError?.message ?? enrollmentError?.message);
    displayName = (profile as any).full_name;
    enrollments = (dbEnrollments ?? []) as any;

    const courseIds = enrollments.map((item: any) => item.course_id);
    if (courseIds.length) {
      const [courseResult, testResult, assignmentResult] = await Promise.all([
        supabase.from('courses').select('*').in('id', courseIds),
        supabase.from('tests').select('*').in('course_id', courseIds).eq('published', true),
        supabase.from('assignments').select('*').in('course_id', courseIds)
      ]);
      const error = courseResult.error ?? testResult.error ?? assignmentResult.error;
      if (error) throw new Error(error.message);
      courses = (courseResult.data ?? []) as any;
      tests = (testResult.data ?? []) as any;
      assignments = (assignmentResult.data ?? []) as any;
    } else {
      courses = [];
      tests = [];
      assignments = [];
    }

    const [attemptResult, submissionResult] = await Promise.all([
      supabase.from('test_attempts').select('*').eq('student_id', user.id),
      supabase.from('submissions').select('*').eq('student_id', user.id)
    ]);
    if (attemptResult.error || submissionResult.error) throw new Error(attemptResult.error?.message ?? submissionResult.error?.message);
    attempts = (attemptResult.data ?? []) as any;
    submissions = (submissionResult.data ?? []) as any;
  }

  const now = new Date();
  const activeTests = tests.filter((test) => now >= new Date(test.available_from) && now <= new Date(test.available_until));
  const scoredAttempts = attempts.filter((attempt) => attempt.score !== null);
  const averageScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + Number(attempt.score), 0) / scoredAttempts.length)
    : null;
  const nextAssignments = assignments
    .filter((assignment) => new Date(assignment.due_date) >= now)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 4);

  const stats = [
    { label: 'Active courses', value: courses.length, detail: `${courses.reduce((sum, course) => sum + course.credits, 0)} credits`, icon: BookOpenIcon },
    { label: 'Open exams', value: activeTests.length, detail: activeTests.length ? 'Ready to attempt' : 'Nothing due now', icon: ClockIcon },
    { label: 'Coursework', value: assignments.length, detail: `${submissions.length} submitted`, icon: FileTextIcon },
    { label: 'Average score', value: averageScore === null ? '—' : `${averageScore}%`, detail: `${scoredAttempts.length} graded assessment${scoredAttempts.length === 1 ? '' : 's'}`, icon: AwardIcon }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-ink-900/[0.07] bg-white p-6 shadow-academic sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mipc-eyebrow">Student overview</p>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink-950 sm:text-4xl">Good to see you, {displayName}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-600">Your courses, deadlines, assessment activity and academic progress in one clear workspace.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/student/courses" className="mipc-button-secondary">View courses</Link>
          <Link href="/student/tests" className="mipc-button-primary">
            Examinations {activeTests.length ? `(${activeTests.length})` : ''} <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="mipc-stat min-h-[148px]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold text-ink-500">{label}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-6 font-display text-3xl font-extrabold tracking-[-0.035em] text-ink-950">{value}</p>
            <p className="mt-1 text-xs text-ink-500">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-mipc-green-700">Current semester</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Your courses</h2>
            </div>
            <Link href="/student/courses" className="text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-900">View all</Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((course) => (
              <Link key={course.id} href={`/student/courses/${course.id}`} className="group rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-mipc-green-700/20 hover:shadow-academic-lg">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course.code}</span>
                  <span className="text-xs font-medium text-ink-400">{course.credits} credits</span>
                </div>
                <h3 className="mt-5 text-lg font-bold leading-snug tracking-[-0.02em]">{course.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{course.description}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-mipc-green-700">
                  Open course <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
            {courses.length === 0 ? <div className="mipc-empty sm:col-span-2">No active course enrolments are available yet.</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-mipc-green-700">Next up</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Deadlines & exams</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            {activeTests.map((test) => (
              <Link key={test.id} href={`/student/tests/${test.id}`} className="group block border-b border-ink-900/[0.06] p-4 last:border-b-0 hover:bg-parchment-50">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-signal-danger"><span className="h-1.5 w-1.5 rounded-full bg-signal-danger" /> Exam open</span>
                  <span className="text-xs text-ink-400">{test.duration_minutes} min</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug text-ink-950">{test.title}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mipc-green-700">Enter exam <ChevronRightIcon className="h-3.5 w-3.5" /></span>
              </Link>
            ))}

            {nextAssignments.map((assignment) => (
              <Link key={assignment.id} href="/student/assignments" className="block border-b border-ink-900/[0.06] p-4 last:border-b-0 hover:bg-parchment-50">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-mipc-green-700">Coursework</span>
                  <span className="text-xs text-ink-400">Due {new Date(assignment.due_date).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug text-ink-950">{assignment.title}</p>
              </Link>
            ))}

            {!activeTests.length && !nextAssignments.length ? (
              <div className="p-7 text-center">
                <CheckCircleIcon className="mx-auto h-6 w-6 text-mipc-green-600" />
                <p className="mt-3 text-sm font-semibold text-ink-900">You&apos;re up to date</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">No immediate deadlines or open exams.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
