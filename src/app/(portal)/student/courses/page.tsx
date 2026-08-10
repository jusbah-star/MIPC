import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  AwardIcon
} from '@/components/icons';

export default async function StudentCoursesPage() {
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'student');
  const studentId = currentStudent?.id ?? 'user-student-1';

  let enrollments = dataStore.enrollments.filter((e) => e.student_id === studentId);
  let courses = dataStore.courses.filter((c) => enrollments.some((e) => e.course_id === c.id));
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
    } else { courses = []; tests = []; assignments = []; }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-brass-600 font-bold block mb-1">
            Academic year 2026/2027
          </span>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Registered Modules & Syllabi
          </h1>
          <p className="mt-1 text-sm text-ink-700">
            Academic modules currently accredited to your candidate record.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => {
          const courseTests = tests.filter((t) => t.course_id === course.id);
          const courseAssignments = assignments.filter((a) => a.course_id === course.id);

          return (
            <div
              key={course.id}
              className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs hover:shadow-academic transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-2.5 py-0.5 rounded">
                    {course.code}
                  </span>
                  <span className="text-xs font-mono text-signal-ok bg-signal-ok-bg px-2 py-0.5 rounded font-semibold uppercase">
                    Enrolled · Active
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-ink-950 mb-2">
                  {course.title}
                </h2>
                <p className="text-sm text-ink-700 leading-relaxed">
                  {course.description}
                </p>

                <div className="mt-6 grid grid-cols-3 gap-2 py-3 border-y border-parchment-200 text-center font-mono">
                  <div>
                    <span className="block text-ink-500 text-[10px] uppercase">Credits</span>
                    <span className="font-bold text-ink-950 text-sm">{course.credits}</span>
                  </div>
                  <div>
                    <span className="block text-ink-500 text-[10px] uppercase">Exams</span>
                    <span className="font-bold text-ink-950 text-sm">{courseTests.length}</span>
                  </div>
                  <div>
                    <span className="block text-ink-500 text-[10px] uppercase">Coursework</span>
                    <span className="font-bold text-ink-950 text-sm">{courseAssignments.length}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-xs font-mono text-ink-500">
                  Lecturer: Dr. A. Turing
                </span>
                <Link
                  href={`/student/courses/${course.id}`}
                  className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 transition-colors flex items-center gap-1.5"
                >
                  <span>Enter Course Room</span>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-brass-400" />
                </Link>
              </div>
            </div>
          );
        })}

        {courses.length === 0 && (
          <div className="col-span-2 bg-white rounded-xl border border-ink-900/10 p-12 text-center text-ink-500">
            No active course enrollments recorded.
          </div>
        )}
      </div>
    </div>
  );
}
