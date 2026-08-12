import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  BookOpenIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  MegaphoneIcon,
  PlusIcon,
  UsersIcon
} from '@/components/icons';

export default async function LecturerDashboard() {
  const currentLecturer = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'lecturer');
  const lecturerId = currentLecturer?.id ?? 'user-lecturer-1';
  let displayName = currentLecturer?.full_name ?? 'MIPC lecturer';
  let activeStudentCount = new Set(
    dataStore.enrollments.filter((item) => item.status === 'active').map((item) => item.student_id)
  ).size;

  let courses = dataStore.courses.filter((course) => course.lecturer_id === lecturerId);
  let tests = dataStore.tests.filter((test) => courses.some((course) => course.id === test.course_id));
  let attempts = dataStore.test_attempts.filter((attempt) => tests.some((test) => test.id === attempt.test_id));
  let assignments = dataStore.assignments.filter((assignment) => courses.some((course) => course.id === assignment.course_id));
  let submissions = dataStore.submissions.filter((submission) => assignments.some((assignment) => assignment.id === submission.assignment_id));
  let pendingGrading = submissions.filter((submission) => submission.grade === null);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Lecturer authentication required.');

    const [{ data: profile, error: profileError }, { data: dbCourses, error: courseError }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('courses').select('*').eq('lecturer_id', user.id)
    ]);
    if (profileError || courseError) throw new Error(profileError?.message ?? courseError?.message);

    displayName = (profile as any).full_name;
    courses = (dbCourses ?? []) as any;
    const courseIds = courses.map((course) => course.id);

    if (courseIds.length) {
      const [testResult, assignmentResult, submissionResult, enrollmentResult] = await Promise.all([
        supabase.from('tests').select('*').in('course_id', courseIds),
        supabase.from('assignments').select('*').in('course_id', courseIds),
        supabase.from('submissions').select('*').in('course_id', courseIds),
        supabase.from('enrollments').select('student_id').in('course_id', courseIds).eq('status', 'active')
      ]);
      const error = testResult.error ?? assignmentResult.error ?? submissionResult.error ?? enrollmentResult.error;
      if (error) throw new Error(error.message);

      tests = (testResult.data ?? []) as any;
      assignments = (assignmentResult.data ?? []) as any;
      submissions = (submissionResult.data ?? []) as any;
      activeStudentCount = new Set(((enrollmentResult.data ?? []) as any[]).map((item) => item.student_id)).size;

      const testIds = tests.map((test) => test.id);
      if (testIds.length) {
        const { data: attemptRows, error: attemptError } = await supabase.from('test_attempts').select('*').in('test_id', testIds);
        if (attemptError) throw new Error(attemptError.message);
        attempts = (attemptRows ?? []) as any;
      } else {
        attempts = [];
      }
    } else {
      tests = [];
      attempts = [];
      assignments = [];
      submissions = [];
      activeStudentCount = 0;
    }

    pendingGrading = submissions.filter((submission) => submission.grade === null);
  }

  const stats = [
    { label: 'Assigned courses', value: courses.length, detail: 'Your current teaching load', icon: BookOpenIcon },
    { label: 'Active students', value: activeStudentCount, detail: 'Unique active enrolments', icon: UsersIcon },
    { label: 'Assessments', value: tests.length, detail: `${attempts.length} total attempts`, icon: ClockIcon },
    { label: 'To grade', value: pendingGrading.length, detail: pendingGrading.length ? 'Needs your attention' : 'Queue is clear', icon: CheckCircleIcon }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-ink-900/[0.07] bg-white p-6 shadow-academic sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mipc-eyebrow">Faculty overview</p>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink-950 sm:text-4xl">Welcome, {displayName}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-600">Manage teaching, assessments, marking and student communication from one focused workspace.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/lecturer/grading" className="mipc-button-secondary">Grading queue {pendingGrading.length ? `(${pendingGrading.length})` : ''}</Link>
          <Link href="/lecturer/tests/new" className="mipc-button-primary">
            <PlusIcon className="h-4 w-4" /> New assessment
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
              <p className="text-xs font-semibold text-mipc-green-700">Teaching</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Your courses</h2>
            </div>
            <Link href="/lecturer/courses" className="text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-900">Manage all</Link>
          </div>

          <div className="grid gap-3">
            {courses.map((course) => {
              const courseTests = tests.filter((test) => test.course_id === course.id);
              const courseAssignments = assignments.filter((assignment) => assignment.course_id === course.id);
              return (
                <article key={course.id} className="rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs transition hover:border-mipc-green-700/20 hover:shadow-academic sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course.code}</span>
                        <span className="text-xs text-ink-400">{course.credits} credits</span>
                      </div>
                      <h3 className="mt-4 text-lg font-bold tracking-[-0.02em]">{course.title}</h3>
                      <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-ink-600">{course.description}</p>
                    </div>
                    <Link href="/lecturer/courses" className="mipc-button-secondary min-h-10 shrink-0 px-3.5 py-2 text-xs">Open course</Link>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-900/[0.06] pt-4 text-xs text-ink-500">
                    <span>{courseTests.length} assessment{courseTests.length === 1 ? '' : 's'}</span>
                    <span>{courseAssignments.length} coursework item{courseAssignments.length === 1 ? '' : 's'}</span>
                  </div>
                </article>
              );
            })}
            {courses.length === 0 ? <div className="mipc-empty">No courses are assigned to this lecturer account yet.</div> : null}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-mipc-green-700">Quick actions</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Teaching tools</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            {[
              { href: '/lecturer/tests/new', label: 'Create an assessment', description: 'Build a test or quiz', icon: PlusIcon },
              { href: '/lecturer/grading', label: 'Review submissions', description: `${pendingGrading.length} waiting for marking`, icon: CheckCircleIcon },
              { href: '/lecturer/announcements', label: 'Publish an announcement', description: 'Update students and staff', icon: MegaphoneIcon }
            ].map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href} className="group flex items-center justify-between gap-4 border-b border-ink-900/[0.06] p-4 last:border-b-0 hover:bg-parchment-50">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-parchment-100 text-mipc-green-700"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-950">{label}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">{description}</span>
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-mipc-green-700" />
              </Link>
            ))}
          </div>

          <div className="rounded-2xl bg-mipc-green-950 p-5 text-white">
            <p className="text-xs font-semibold text-mipc-green-300">Assessment security</p>
            <p className="mt-2 text-sm leading-6 text-white/65">Student answer keys stay server-side and are only evaluated during secure submission.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
