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
    } else { enrollments = []; students = []; tests = []; attempts = []; materials = []; }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mipc-eyebrow">Teaching workspace</p><h1 className="mipc-page-title">Courses, materials and rosters</h1><p className="mt-2 max-w-2xl text-sm text-ink-700">Publish secure learning resources and monitor the students assigned to your courses.</p></div>
        <Link href="/lecturer/tests/new" className="mipc-button-primary"><PlusIcon className="h-4 w-4" /> New assessment</Link>
      </header>

      <form action={publishCourseMaterial} className="mipc-panel grid grid-cols-1 gap-5 p-6 lg:grid-cols-2" aria-labelledby="new-material-title">
        <div className="lg:col-span-2"><h2 id="new-material-title" className="font-display text-xl font-bold text-ink-950">Add course material</h2><p className="mt-1 text-sm text-ink-600">Use HTTPS links for documents stored in an approved institutional repository.</p></div>
        <div><label className="mipc-label" htmlFor="course_id">Course</label><select className="mipc-input" id="course_id" name="course_id" required><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></div>
        <div><label className="mipc-label" htmlFor="material_type">Material type</label><select className="mipc-input" id="material_type" name="material_type" required><option value="note">Study note</option><option value="document">Document link</option><option value="link">External resource</option></select></div>
        <div className="lg:col-span-2"><label className="mipc-label" htmlFor="title">Title</label><input className="mipc-input" id="title" name="title" minLength={3} maxLength={180} required /></div>
        <div><label className="mipc-label" htmlFor="resource_url">HTTPS resource link</label><input className="mipc-input" id="resource_url" name="resource_url" type="url" pattern="https://.*" placeholder="https://…" /></div>
        <div><label className="mipc-label" htmlFor="description">Description</label><input className="mipc-input" id="description" name="description" maxLength={3000} /></div>
        <div className="lg:col-span-2"><label className="mipc-label" htmlFor="content">Study note or instructions</label><textarea className="mipc-input" id="content" name="content" rows={4} maxLength={20000} /></div>
        <div className="flex flex-wrap items-center justify-between gap-4 lg:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold text-ink-800"><input type="checkbox" name="published" className="h-4 w-4 accent-mipc-green-700" /> Publish to enrolled students</label><button type="submit" className="mipc-button-primary" disabled={courses.length === 0}><FileTextIcon className="h-4 w-4" /> Save material</button></div>
      </form>

      <div className="space-y-6">
        {courses.map((course) => {
          const courseEnrollments = enrollments.filter((item) => item.course_id === course.id);
          const courseStudents = students.filter((student) => courseEnrollments.some((item) => item.student_id === student.id));
          const courseTests = tests.filter((item) => item.course_id === course.id);
          const courseMaterials = materials.filter((item) => item.course_id === course.id);
          return <section key={course.id} className="mipc-panel overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-parchment-200 bg-parchment-50 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{course.code} · {course.credits} credits</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{course.title}</h2></div><Link href={`/lecturer/tests/new?courseId=${course.id}`} className="mipc-button-secondary">Add assessment</Link></div>
            <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-2">
              <div><h3 className="mipc-label flex items-center gap-2"><BookOpenIcon className="h-4 w-4" /> Materials ({courseMaterials.length})</h3><div className="mt-3 space-y-3">{courseMaterials.map((material) => <article key={material.id} className="rounded-xl border border-parchment-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-ink-950">{material.title}</p><p className="mt-1 text-xs text-ink-600">{material.description}</p></div><span className="mipc-status">{material.published ? 'Published' : 'Draft'}</span></div>{material.resource_url && <a href={material.resource_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-mipc-green-700">Open resource</a>}</article>)}{courseMaterials.length === 0 && <p className="text-sm text-ink-600">No course materials yet.</p>}</div></div>
              <div><h3 className="mipc-label flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Active roster ({courseStudents.length})</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-ink-500"><tr><th className="py-2">Student</th><th className="py-2">Email</th><th className="py-2">Attempts</th></tr></thead><tbody className="divide-y divide-parchment-200">{courseStudents.map((student) => { const completed = attempts.filter((attempt) => attempt.student_id === student.id && courseTests.some((test) => test.id === attempt.test_id)); return <tr key={student.id}><td className="py-3 font-semibold text-ink-950">{student.full_name}</td><td className="py-3 text-ink-600">{student.email}</td><td className="py-3 text-ink-600">{completed.length}</td></tr>; })}</tbody></table></div></div>
            </div>
          </section>;
        })}
        {courses.length === 0 && <div className="mipc-empty">No courses are assigned to this lecturer account.</div>}
      </div>
    </div>
  );
}
