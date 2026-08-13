import { BookOpenIcon, UsersIcon, PlusIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createCohort, createCourse } from './actions';

export default async function AdminCoursesPage() {
  let courses: any[] = dataStore.courses;
  let cohorts: any[] = dataStore.cohorts;
  let departments: any[] = dataStore.departments;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [courseResult, cohortResult, departmentResult] = await Promise.all([
      supabase.from('courses').select('*').order('code'),
      supabase.from('cohorts').select('*').order('start_date', { ascending: false }),
      supabase.from('departments').select('*').order('name')
    ]);
    const error = courseResult.error ?? cohortResult.error ?? departmentResult.error;
    if (error) throw new Error(error.message);
    courses = (courseResult.data ?? []) as any[];
    cohorts = (cohortResult.data ?? []) as any[];
    departments = (departmentResult.data ?? []) as any[];
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mipc-eyebrow">Academic registry</p>
          <h1 className="mipc-page-title">Curriculum and cohorts</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-700">Create academic intakes and courses. Courses assigned to a cohort are automatically added to all active students in that cohort.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="mipc-status">{courses.length} courses</span>
          <span className="mipc-status">{cohorts.length} cohorts</span>
          <span className="mipc-status">{departments.length} departments</span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-mipc-navy-900/10 bg-white p-6 shadow-academic">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800"><UsersIcon className="h-5 w-5" /></span>
            <div><h2 className="font-display text-xl font-bold text-mipc-navy-950">Create cohort / intake</h2><p className="mt-1 text-sm text-ink-600">Examples: ICT September 2026, Hospitality January 2027.</p></div>
          </div>
          <form action={createCohort} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="mipc-label" htmlFor="cohort-name">Cohort name</label><input className="mipc-field" id="cohort-name" name="name" required placeholder="ICT September 2026" /></div>
            <div className="sm:col-span-2"><label className="mipc-label" htmlFor="cohort-dept">Department</label><select className="mipc-field" id="cohort-dept" name="department_id" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div><label className="mipc-label" htmlFor="cohort-start">Start date</label><input className="mipc-field" id="cohort-start" name="start_date" type="date" required /></div>
            <div><label className="mipc-label" htmlFor="cohort-end">Expected end date</label><input className="mipc-field" id="cohort-end" name="end_date" type="date" /></div>
            <div className="sm:col-span-2"><button className="mipc-button-primary w-full !bg-mipc-green-700" type="submit"><PlusIcon className="h-4 w-4" /> Create cohort</button></div>
          </form>
        </section>

        <section className="rounded-2xl border border-mipc-navy-900/10 bg-white p-6 shadow-academic">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800"><BookOpenIcon className="h-5 w-5" /></span>
            <div><h2 className="font-display text-xl font-bold text-mipc-navy-950">Create course</h2><p className="mt-1 text-sm text-ink-600">Assign a cohort to automatically enroll that cohort's students.</p></div>
          </div>
          <form action={createCourse} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><label className="mipc-label" htmlFor="course-code">Course code</label><input className="mipc-field uppercase" id="course-code" name="code" required placeholder="ICT101" /></div>
            <div><label className="mipc-label" htmlFor="course-credits">Credits</label><input className="mipc-field" id="course-credits" name="credits" type="number" min="1" max="60" defaultValue="3" required /></div>
            <div className="sm:col-span-2"><label className="mipc-label" htmlFor="course-title">Course title</label><input className="mipc-field" id="course-title" name="title" required placeholder="Introduction to Information Technology" /></div>
            <div><label className="mipc-label" htmlFor="course-dept">Department</label><select className="mipc-field" id="course-dept" name="department_id" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div><label className="mipc-label" htmlFor="course-cohort">Cohort</label><select className="mipc-field" id="course-cohort" name="cohort_id" defaultValue=""><option value="">Open / no cohort</option>{cohorts.map((cohort) => { const department = departments.find((d) => d.id === cohort.department_id); return <option key={cohort.id} value={cohort.id}>{cohort.name}{department ? ` · ${department.code}` : ''}</option>; })}</select></div>
            <div className="sm:col-span-2"><label className="mipc-label" htmlFor="course-description">Description</label><textarea className="mipc-field min-h-24" id="course-description" name="description" maxLength={2000} /></div>
            <div className="sm:col-span-2"><button className="mipc-button-primary w-full !bg-mipc-green-700" type="submit"><PlusIcon className="h-4 w-4" /> Create course</button></div>
          </form>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Courses" value={courses.length} icon={<BookOpenIcon className="h-5 w-5" />} />
        <Metric label="Cohorts" value={cohorts.length} icon={<UsersIcon className="h-5 w-5" />} />
        <Metric label="Departments" value={departments.length} icon={<BookOpenIcon className="h-5 w-5" />} />
      </div>

      <section className="mipc-panel overflow-hidden" aria-labelledby="cohort-register">
        <div className="border-b border-parchment-200 p-5"><h2 id="cohort-register" className="font-display text-xl font-bold text-ink-950">Cohort register</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600"><tr><th className="px-5 py-3">Cohort</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Starts</th><th className="px-5 py-3">Ends</th></tr></thead>
            <tbody className="divide-y divide-parchment-200">{cohorts.map((cohort) => <tr key={cohort.id}><td className="px-5 py-4 font-semibold text-ink-950">{cohort.name}</td><td className="px-5 py-4 text-ink-700">{departments.find((item) => item.id === cohort.department_id)?.name ?? 'Not assigned'}</td><td className="px-5 py-4 text-ink-700">{cohort.start_date}</td><td className="px-5 py-4 text-ink-700">{cohort.end_date ?? 'Open'}</td></tr>)}</tbody>
          </table>
        </div>
        {cohorts.length === 0 && <p className="p-8 text-center text-sm text-ink-600">No cohorts are registered yet. Create the first intake above.</p>}
      </section>

      <section className="mipc-panel overflow-hidden" aria-labelledby="course-register">
        <div className="border-b border-parchment-200 p-5"><h2 id="course-register" className="font-display text-xl font-bold text-ink-950">Course register</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Credits</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Cohort</th></tr></thead>
            <tbody className="divide-y divide-parchment-200">
              {courses.map((course) => <tr key={course.id}><td className="px-5 py-4 font-mono font-bold text-mipc-green-800">{course.code}</td><td className="px-5 py-4 font-semibold text-ink-950">{course.title}</td><td className="px-5 py-4 text-ink-700">{course.credits}</td><td className="px-5 py-4 text-ink-700">{departments.find((item) => item.id === course.department_id)?.name ?? 'Not assigned'}</td><td className="px-5 py-4 text-ink-700">{cohorts.find((item) => item.id === course.cohort_id)?.name ?? 'Open'}</td></tr>)}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && <p className="p-8 text-center text-sm text-ink-600">No courses are registered yet. Create the first course above.</p>}
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="mipc-panel flex items-center gap-4 p-5"><span className="rounded-xl bg-mipc-green-100 p-3 text-mipc-green-800">{icon}</span><div><p className="text-2xl font-bold text-ink-950">{value}</p><p className="text-xs uppercase tracking-wider text-ink-600">{label}</p></div></div>;
}
