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

  const metrics = [
    { label: 'Courses', value: courses.length, icon: BookOpenIcon },
    { label: 'Cohorts', value: cohorts.length, icon: UsersIcon },
    { label: 'Departments', value: departments.length, icon: BookOpenIcon }
  ];

  return (
    <div className="space-y-7">
      <header>
        <p className="mipc-eyebrow">Academic registry</p>
        <h1 className="mipc-page-title">Curriculum & cohorts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">A consolidated view of registered courses and how they connect to academic departments and student cohorts.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="mipc-stat flex items-center gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><Icon className="h-5 w-5" /></span>
            <div><p className="font-display text-2xl font-extrabold tracking-tight text-ink-950">{value}</p><p className="mt-0.5 text-xs font-medium text-ink-500">{label}</p></div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs" aria-labelledby="course-register">
        <div className="border-b border-ink-900/[0.07] p-5 sm:p-6">
          <h2 id="course-register" className="text-lg font-bold tracking-[-0.02em]">Course register</h2>
          <p className="mt-1 text-xs text-ink-500">Current course records by department and cohort.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="mipc-table min-w-[720px]">
            <thead><tr><th>Code</th><th>Course</th><th>Department</th><th>Cohort</th></tr></thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td><span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course.code}</span></td>
                  <td><p className="font-semibold text-ink-950">{course.title}</p>{course.credits ? <p className="mt-1 text-xs text-ink-400">{course.credits} credits</p> : null}</td>
                  <td>{departments.find((item) => item.id === course.department_id)?.name ?? 'Not assigned'}</td>
                  <td>{cohorts.find((item) => item.id === course.cohort_id)?.name ?? 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {courses.length === 0 ? <div className="mipc-empty m-4">No courses are registered.</div> : null}
      </section>
    </div>
  );
}
