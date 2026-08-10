import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  BookOpenIcon,
  ClockIcon,
  FileTextIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  AwardIcon,
  MegaphoneIcon
} from '@/components/icons';

export default async function StudentDashboard() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';
  let displayName = currentStudent?.full_name ?? 'MIPC student';

  // Get enrolled courses
  let enrollments = dataStore.enrollments.filter((e) => e.student_id === studentId);
  let courses = dataStore.courses.filter((c) => enrollments.some((e) => e.course_id === c.id));
  let tests = dataStore.tests.filter((t) => courses.some((c) => c.id === t.course_id));
  let attempts = dataStore.test_attempts.filter((a) => a.student_id === studentId);
  let assignments = dataStore.assignments.filter((a) => courses.some((c) => c.id === a.course_id));
  let submissions = dataStore.submissions.filter((s) => s.student_id === studentId);

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

  const activeTests = tests.filter((t) => {
    const now = new Date();
    return now >= new Date(t.available_from) && now <= new Date(t.available_until);
  });
  const scoredAttempts = attempts.filter((attempt) => attempt.score !== null);
  const averageScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + Number(attempt.score), 0) / scoredAttempts.length)
    : null;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-ink-950 to-ink-900 text-white rounded-2xl p-6 sm:p-8 shadow-academic border border-ink-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-brass-400 font-semibold block mb-1">
            Academic year 2026/2027 · Student workspace
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-500 font-mono">
            Your courses, assessments and practical coursework in one secure record
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/student/tests"
            className="rounded-lg bg-brass-500 px-4 py-2 text-xs sm:text-sm font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <ClockIcon className="w-4 h-4" />
            <span>Active Exams ({activeTests.length})</span>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Active Modules</span>
            <BookOpenIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{courses.length}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Total {courses.reduce((acc, c) => acc + c.credits, 0)} Academic Credits</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Examinations</span>
            <ClockIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{activeTests.length}</div>
          <p className="text-[11px] text-signal-ok mt-1 font-mono font-medium">Ready for attempt</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Coursework</span>
            <FileTextIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{assignments.length}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">{submissions.length} submitted</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Average Score</span>
            <AwardIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-signal-ok">{averageScore === null ? '—' : `${averageScore}%`}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Across {scoredAttempts.length} graded assessment{scoredAttempts.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {/* Main Grid: Enrolled Courses & Upcoming Deliverables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Enrolled Courses (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-950">
              Enrolled Modules & Syllabi
            </h2>
            <Link
              href="/student/courses"
              className="text-xs font-mono text-brass-600 hover:text-brass-700 flex items-center gap-1"
            >
              <span>View All Modules</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs hover:shadow-academic transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-2 py-0.5 rounded">
                      {c.code}
                    </span>
                    <span className="text-xs font-mono text-ink-500">
                      {c.credits} Credits
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-950 mb-1.5 leading-snug">
                    {c.title}
                  </h3>
                  <p className="text-xs text-ink-600 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-parchment-200 flex items-center justify-between">
                  <span className="text-[11px] text-ink-500 font-mono">
                    MIPC course record
                  </span>
                  <Link
                    href={`/student/courses/${c.id}`}
                    className="text-xs font-medium text-brass-600 hover:text-brass-700 flex items-center gap-0.5"
                  >
                    <span>Course Room</span>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Item Timeline / Urgent Deadlines (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-950">
              Immediate Deadlines
            </h2>
            <Link
              href="/student/tests"
              className="text-xs font-mono text-brass-600 hover:text-brass-700"
            >
              Exam Center
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs space-y-4">
            {activeTests.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg border border-brass-400/30 bg-parchment-50/60 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-signal-danger font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-signal-danger animate-ping" />
                      Examination Open
                    </span>
                    <span className="text-xs font-mono text-ink-600">{t.duration_minutes} mins</span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-ink-950 leading-snug">
                    {t.title}
                  </h4>
                </div>
                <Link
                  href={`/student/tests/${t.id}`}
                  className="rounded-md bg-ink-900 text-white text-xs font-medium py-1.5 px-3 text-center hover:bg-ink-800 transition-colors flex items-center justify-center gap-1"
                >
                  <span>Enter Examination</span>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-brass-400" />
                </Link>
              </div>
            ))}

            {assignments.map((a) => (
              <div
                key={a.id}
                className="p-3 rounded-lg border border-parchment-200 bg-white flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-brass-700 font-bold">
                    Coursework
                  </span>
                  <span className="text-[11px] font-mono text-ink-500">
                    Due {new Date(a.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <h4 className="font-display text-xs font-bold text-ink-950 leading-snug">
                  {a.title}
                </h4>
                <Link
                  href="/student/assignments"
                  className="text-xs font-medium text-brass-600 hover:text-brass-700 flex items-center gap-1"
                >
                  <span>Submit Solution &rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
