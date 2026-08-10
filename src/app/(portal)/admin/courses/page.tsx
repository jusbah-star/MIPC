import { BookOpenIcon, UsersIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export default async function AdminCoursesPage() {
  let courses: any[] = dataStore.courses;
  let cohorts: any[] = dataStore.cohorts;
  let departments: any[] = dataStore.departments;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [courseResult, cohortResult, departmentResult] = await Promise.all([
      supabase.from('courses').select('*').order('code'),
      supabase.from('cohorts').select('*').order('name'),
      supabase.from('departments').select('*').order('name')
    ]);
    const error = courseResult.error ?? cohortResult.error ?? departmentResult.error;
    if (error) throw new Error(error.message);
    courses = courseResult.data ?? [];
    cohorts = cohortResult.data ?? [];
    departments = departmentResult.data ?? [];
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mipc-eyebrow">Academic registry</p>
        <h1 className="mipc-page-title">Curriculum and cohorts</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-700">A consolidated view of registered courses, their departments and student cohorts.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Courses" value={courses.length} icon={<BookOpenIcon className="h-5 w-5" />} />
        <Metric label="Cohorts" value={cohorts.length} icon={<UsersIcon className="h-5 w-5" />} />
        <Metric label="Departments" value={departments.length} icon={<BookOpenIcon className="h-5 w-5" />} />
      </div>
      <section className="mipc-panel overflow-hidden" aria-labelledby="course-register">
        <div className="border-b border-parchment-200 p-5"><h2 id="course-register" className="font-display text-xl font-bold text-ink-950">Course register</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Cohort</th></tr></thead>
            <tbody className="divide-y divide-parchment-200">
              {courses.map((course) => <tr key={course.id}><td className="px-5 py-4 font-mono font-bold text-mipc-green-800">{course.code}</td><td className="px-5 py-4 font-semibold text-ink-950">{course.title}</td><td className="px-5 py-4 text-ink-700">{departments.find((item) => item.id === course.department_id)?.name ?? 'Not assigned'}</td><td className="px-5 py-4 text-ink-700">{cohorts.find((item) => item.id === course.cohort_id)?.name ?? 'Open'}</td></tr>)}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && <p className="p-8 text-center text-sm text-ink-600">No courses are registered.</p>}
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="mipc-panel flex items-center gap-4 p-5"><span className="rounded-xl bg-mipc-green-100 p-3 text-mipc-green-800">{icon}</span><div><p className="text-2xl font-bold text-ink-950">{value}</p><p className="text-xs uppercase tracking-wider text-ink-600">{label}</p></div></div>;
}
