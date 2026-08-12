import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpenIcon, FileTextIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { publishCourseMaterial } from './actions';

export default async function LecturerCoursesPage() {
  let courses: any[] = dataStore.courses.filter((item) => item.lecturer_id === 'user-lecturer-1');
  let enrollments: any[] = dataStore.enrollments.filter((item) => courses.some((course) => course.id === item.course_id));
  let students: any[] = dataStore.profiles.filter((item) => item.role === 'student');
  let tests: any[] = dataStore.tests.filter((item) => courses.some((course) => course.id === item.course_id));
  let attempts: any[] = dataStore.test_attempts;
  let materials: any[] = dataStore.course_materials.filter((item) => courses.some((course) => course.id === item.course_id));

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: courseRows, error: courseError } = await supabase.from('courses').select('*').eq('lecturer_id', user.id).order('code');
    if (courseError) throw new Error(courseError.message);
    courses = (courseRows ?? []) as any;
    const courseIds = courses.map((course) => course.id);

    if (courseIds.length) {
      const [enrollmentResult, testResult, materialResult] = await Promise.all([
        supabase.from('enrollments').select('*').in('course_id', courseIds).eq('status', 'active'),
        supabase.from('tests').select('*').in('course_id', courseIds),
        supabase.from('course_materials').select('*').in('course_id', courseIds).order('created_at', { ascending: false })
      ]);
      const error = enrollmentResult.error ?? testResult.error ?? materialResult.error;
      if (error) throw new Error(error.message);
      enrollments = (enrollmentResult.data ?? []) as any;
      tests = (testResult.data ?? []) as any;
      materials = (materialResult.data ?? []) as any;

      const studentIds = Array.from(new Set(enrollments.map((item) => item.student_id)));
      const testIds = tests.map((item) => item.id);
      if (studentIds.length) {
        const { data, error: studentError } = await supabase.from('profiles').select('*').in('id', studentIds);
        if (studentError) throw new Error(studentError.message);
        students = (data ?? []) as any;
      } else students = [];
      if (testIds.length) {
        const { data, error: attemptError } = await supabase.from('test_attempts').select('*').in('test_id', testIds);
        if (attemptError) throw new Error(attemptError.message);
        attempts = (data ?? []) as any;
      } else attempts = [];
    } else {
      enrollments = [];
      students = [];
      tests = [];
      attempts = [];
      materials = [];
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Courses</p>
          <h1 className="mipc-page-title">Materials & rosters</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Publish learning resources and review the students and assessment activity connected to your courses.</p>
        </div>
        <Link href="/lecturer/tests/new" className="mipc-button-primary"><PlusIcon className="h-4 w-4" /> New assessment</Link>
      </header>

      <form action={publishCourseMaterial} className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8" aria-labelledby="new-material-title">
        <div className="flex items-center gap-3 border-b border-ink-900/[0.07] pb-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><FileTextIcon className="h-5 w-5" /></span>
          <div><p className="text-xs font-semibold text-mipc-green-700">Course content</p><h2 id="new-material-title" className="mt-0.5 text-lg font-bold">Add learning material</h2></div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div><label className="mipc-label" htmlFor="course_id">Course</label><select className="mipc-input" id="course_id" name="course_id" required><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></div>
          <div><label className="mipc-label" htmlFor="material_type">Material type</label><select className="mipc-input" id="material_type" name="material_type" required><option value="note">Study note</option><option value="document">Document link</option><option value="link">External resource</option></select></div>
          <div className="lg:col-span-2"><label className="mipc-label" htmlFor="title">Title</label><input className="mipc-input" id="title" name="title" minLength={3} maxLength={180} required placeholder="Name this resource clearly" /></div>
          <div><label className="mipc-label" htmlFor="resource_url">HTTPS resource link</label><input className="mipc-input" id="resource_url" name="resource_url" type="url" pattern="https://.*" placeholder="https://…" /></div>
          <div><label className="mipc-label" htmlFor="description">Description</label><input className="mipc-input" id="description" name="description" maxLength={3000} placeholder="Short description" /></div>
          <div className="lg:col-span-2"><label className="mipc-label" htmlFor="content">Study note or instructions</label><textarea className="mipc-input" id="content" name="content" rows={4} maxLength={20000} placeholder="Add the learning note or instructions here." /></div>
          <div className="flex flex-col gap-4 border-t border-ink-900/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-ink-600"><input type="checkbox" name="published" className="h-4 w-4 accent-mipc-green-700" /> Publish to enrolled students</label>
            <button type="submit" className="mipc-button-primary" disabled={courses.length === 0}><FileTextIcon className="h-4 w-4" /> Save material</button>
          </div>
        </div>
      </form>

      <div className="space-y-5">
        {courses.map((course) => {
          const courseEnrollments = enrollments.filter((item) => item.course_id === course.id);
          const courseStudents = students.filter((student) => courseEnrollments.some((item) => item.student_id === student.id));
          const courseTests = tests.filter((item) => item.course_id === course.id);
          const courseMaterials = materials.filter((item) => item.course_id === course.id);

          return (
            <section key={course.id} className="overflow-hidden rounded-3xl border border-ink-900/[0.08] bg-white shadow-xs">
              <div className="flex flex-col gap-4 border-b border-ink-900/[0.07] bg-parchment-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course.code}</span><span className="text-xs text-ink-400">{course.credits} credits</span></div>
                  <h2 className="mt-3 text-xl font-bold tracking-[-0.025em] text-ink-950">{course.title}</h2>
                </div>
                <Link href={`/lecturer/tests/new?courseId=${course.id}`} className="mipc-button-secondary">Add assessment</Link>
              </div>

              <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-ink-900/[0.07]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><BookOpenIcon className="h-4 w-4 text-mipc-green-700" /> Materials</h3><span className="text-xs text-ink-400">{courseMaterials.length}</span></div>
                  <div className="mt-4 divide-y divide-ink-900/[0.06]">
                    {courseMaterials.map((material) => (
                      <article key={material.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink-950">{material.title}</p><p className="mt-1 text-xs leading-5 text-ink-500">{material.description}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${material.published ? 'bg-signal-ok-bg text-signal-ok' : 'bg-parchment-200 text-ink-500'}`}>{material.published ? 'Published' : 'Draft'}</span></div>
                        {material.resource_url ? <a href={material.resource_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-mipc-green-700">Open resource</a> : null}
                      </article>
                    ))}
                    {courseMaterials.length === 0 ? <p className="py-4 text-sm text-ink-500">No course materials yet.</p> : null}
                  </div>
                </div>

                <div className="border-t border-ink-900/[0.07] p-5 sm:p-6 xl:border-t-0">
                  <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900"><UsersIcon className="h-4 w-4 text-mipc-green-700" /> Active roster</h3><span className="text-xs text-ink-400">{courseStudents.length}</span></div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="mipc-table min-w-[480px]">
                      <thead><tr><th>Student</th><th>Email</th><th>Attempts</th></tr></thead>
                      <tbody>{courseStudents.map((student) => { const completed = attempts.filter((attempt) => attempt.student_id === student.id && courseTests.some((test) => test.id === attempt.test_id)); return <tr key={student.id}><td className="font-semibold text-ink-950">{student.full_name}</td><td>{student.email}</td><td>{completed.length}</td></tr>; })}</tbody>
                    </table>
                  </div>
                  {courseStudents.length === 0 ? <p className="mt-4 text-sm text-ink-500">No active students in this course.</p> : null}
                </div>
              </div>
            </section>
          );
        })}
        {courses.length === 0 ? <div className="mipc-empty">No courses are assigned to this lecturer account.</div> : null}
      </div>
    </div>
  );
}
