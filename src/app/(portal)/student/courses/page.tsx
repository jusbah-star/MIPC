import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { BookOpenIcon, ChevronRightIcon } from '@/components/icons';

export default async function StudentCoursesPage() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';

  let enrollments = dataStore.enrollments.filter((enrollment) => enrollment.student_id === studentId);
  let courses = dataStore.courses.filter((course) => enrollments.some((enrollment) => enrollment.course_id === course.id));
  let tests = dataStore.tests;
  let assignments = dataStore.assignments;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Student authentication required.');

    const { data: dbEnrollments, error: enrollmentError } = await supabase.from('enrollments').select('*').eq('student_id', user.id).eq('status', 'active');
    if (enrollmentError) throw new Error(enrollmentError.message);
    enrollments = (dbEnrollments ?? []) as any;
    const ids = enrollments.map((item: any) => item.course_id);

    if (ids.length) {
      const [courseResult, testResult, assignmentResult] = await Promise.all([
        supabase.from('courses').select('*').in('id', ids),
        supabase.from('tests').select('*').in('course_id', ids).eq('published', true),
        supabase.from('assignments').select('*').in('course_id', ids)
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
  }

  const totalCredits = courses.reduce((sum, course) => sum + Number(course.credits ?? 0), 0);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Academic year 2026/2027</p>
          <h1 className="mipc-page-title">My courses</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Access course materials, assessments, assignments and lecturer information for your active enrolments.</p>
        </div>
        <div className="flex gap-2"><span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-xs font-semibold text-mipc-green-700">{courses.length} courses</span><span className="rounded-full bg-parchment-200 px-3 py-1.5 text-xs font-semibold text-ink-600">{totalCredits} credits</span></div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => {
          const courseTests = tests.filter((test) => test.course_id === course.id);
          const courseAssignments = assignments.filter((assignment) => assignment.course_id === course.id);

          return (
            <Link key={course.id} href={`/student/courses/${course.id}`} className="group flex min-h-[280px] flex-col rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-mipc-green-700/20 hover:shadow-academic-lg">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><BookOpenIcon className="h-5 w-5" /></span>
                <span className="rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok">Active</span>
              </div>
              <div className="mt-7">
                <p className="text-xs font-semibold text-mipc-green-700">{course.code}</p>
                <h2 className="mt-2 text-xl font-bold leading-snug tracking-[-0.025em] text-ink-950">{course.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">{course.description}</p>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-3 border-t border-ink-900/[0.07] pt-5 text-xs text-ink-500">
                <div><strong className="block text-sm font-semibold text-ink-900">{course.credits}</strong><span>Credits</span></div>
                <div><strong className="block text-sm font-semibold text-ink-900">{courseTests.length}</strong><span>Exams</span></div>
                <div><strong className="block text-sm font-semibold text-ink-900">{courseAssignments.length}</strong><span>Coursework</span></div>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-mipc-green-700">Open course <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          );
        })}
        {courses.length === 0 ? <div className="mipc-empty md:col-span-2">No active course enrolments are recorded.</div> : null}
      </div>
    </div>
  );
}
