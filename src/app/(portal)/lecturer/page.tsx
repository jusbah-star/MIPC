import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  BookOpenIcon,
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  PlusIcon,
  MegaphoneIcon,
  FileTextIcon
} from '@/components/icons';

export default async function LecturerDashboard() {
  const currentLecturer = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'lecturer');
  const lecturerId = currentLecturer?.id ?? 'user-lecturer-1';
  let displayName = currentLecturer?.full_name ?? 'MIPC lecturer';
  let activeStudentCount = new Set(dataStore.enrollments.filter((item) => item.status === 'active').map((item) => item.student_id)).size;

  let courses = dataStore.courses.filter((c) => c.lecturer_id === lecturerId);
  let tests = dataStore.tests.filter((t) => courses.some((c) => c.id === t.course_id));
  let attempts = dataStore.test_attempts.filter((a) => tests.some((t) => t.id === a.test_id));
  let assignments = dataStore.assignments.filter((a) => courses.some((c) => c.id === a.course_id));
  let submissions = dataStore.submissions.filter((s) => assignments.some((a) => a.id === s.assignment_id));
  let pendingGrading = submissions.filter((s) => s.grade === null);

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
      } else attempts = [];
    } else {
      tests = [];
      attempts = [];
      assignments = [];
      submissions = [];
      activeStudentCount = 0;
    }
    pendingGrading = submissions.filter((submission) => submission.grade === null);
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-ink-950 to-ink-900 text-white rounded-2xl p-6 sm:p-8 shadow-academic border border-ink-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-brass-400 font-semibold block mb-1">
            MIPC faculty workspace · Academic year 2026/2027
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-500 font-mono">
            Manage course curriculum, deploy timed examinations, and review student coursework.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/lecturer/tests/new"
            className="rounded-lg bg-brass-500 px-4 py-2 text-xs sm:text-sm font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
          <Link
            href="/lecturer/grading"
            className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"
          >
            <CheckCircleIcon className="w-4 h-4 text-brass-400" />
            <span>Grading Queue ({pendingGrading.length})</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Assigned Modules</span>
            <BookOpenIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{courses.length}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Courses assigned to your account</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Active Students</span>
            <UsersIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{activeStudentCount}</div>
          <p className="text-[11px] text-signal-ok mt-1 font-mono font-medium">Unique active enrolments</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Examinations</span>
            <ClockIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{tests.length}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">{attempts.length} total attempts</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Pending Marking</span>
            <CheckCircleIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-brass-700">{pendingGrading.length}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Submissions awaiting review</p>
        </div>
      </div>

      {/* Main Grid: Modules & Examinations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Module Management (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-950">
              Convened Academic Modules
            </h2>
            <Link
              href="/lecturer/courses"
              className="text-xs font-mono text-brass-600 hover:text-brass-700 flex items-center gap-1"
            >
              <span>View Roster & Cohorts</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {courses.map((course) => {
              const courseTests = tests.filter((t) => t.course_id === course.id);
              const courseAssignments = assignments.filter((a) => a.course_id === course.id);

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs hover:border-brass-400/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-2.5 py-0.5 rounded">
                      {course.code}
                    </span>
                    <span className="text-xs font-mono text-ink-500">
                      {course.credits} credits
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-ink-950 mb-2">
                    {course.title}
                  </h3>
                  <p className="text-sm text-ink-700 leading-relaxed mb-4">
                    {course.description}
                  </p>

                  <div className="pt-4 border-t border-parchment-200 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-4 text-ink-600">
                      <span>{courseTests.length} Exams Active</span>
                      <span>·</span>
                      <span>{courseAssignments.length} Assignments</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/lecturer/tests/new?courseId=${course.id}`}
                        className="bg-parchment-100 hover:bg-parchment-200 text-ink-900 px-3 py-1.5 rounded transition-colors"
                      >
                        + Add Exam
                      </Link>
                      <Link
                        href="/lecturer/courses"
                        className="bg-ink-900 text-white px-3 py-1.5 rounded hover:bg-ink-800 transition-colors"
                      >
                        Manage Module
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions & Live Assessment Stats (1 col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs">
            <h3 className="font-display text-base font-bold text-ink-950 mb-4">
              Faculty Tools
            </h3>
            <div className="space-y-2">
              <Link
                href="/lecturer/tests/new"
                className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-mono font-medium text-ink-900"
              >
                <div className="flex items-center gap-2.5">
                  <PlusIcon className="w-4 h-4 text-brass-600" />
                  <span>Create Assessment / Quiz</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-400" />
              </Link>

              <Link
                href="/lecturer/grading"
                className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-mono font-medium text-ink-900"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircleIcon className="w-4 h-4 text-brass-600" />
                  <span>Mark Coursework Submissions</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-400" />
              </Link>

              <Link
                href="/lecturer/announcements"
                className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-mono font-medium text-ink-900"
              >
                <div className="flex items-center gap-2.5">
                  <MegaphoneIcon className="w-4 h-4 text-brass-600" />
                  <span>Publish Academic Bulletin</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-ink-400" />
              </Link>
            </div>
          </div>

          <div className="bg-parchment-100/70 rounded-xl border border-parchment-300 p-5">
            <h4 className="font-display text-xs font-bold text-ink-950 mb-1">
              Assessment Rigor Note
            </h4>
            <p className="text-[11px] font-mono text-ink-700 leading-relaxed">
              When creating multiple-choice questions, the correct answer is automatically stripped from the public API view and only evaluated on the secure server during submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
