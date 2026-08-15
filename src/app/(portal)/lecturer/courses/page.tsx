import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpenIcon, PlusIcon, UsersIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export default async function LecturerCoursesPage() {
  let courses: any[] = dataStore.courses.filter((item) => item.lecturer_id === 'user-lecturer-1');
  let convenorCourseIds = new Set(courses.map((course) => course.id));
  let classAssignments: any[] = [];
  let classSections: any[] = [];
  let enrollments: any[] = dataStore.enrollments.filter((item) => courses.some((course) => course.id === item.course_id));
  let students: any[] = dataStore.profiles.filter((item) => item.role === 'student');
  let tests: any[] = dataStore.tests.filter((item) => courses.some((course) => course.id === item.course_id));
  let attempts: any[] = dataStore.test_attempts;
  let materials: any[] = dataStore.course_materials.filter((item) => courses.some((course) => course.id === item.course_id));

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [directResult, assignmentResult] = await Promise.all([
      supabase.from('courses').select('*').eq('lecturer_id', user.id).order('code'),
      (supabase as any).from('course_class_assignments').select('course_id,class_section_id,lecturer_id').eq('lecturer_id', user.id)
    ]);
    if (directResult.error || assignmentResult.error) throw new Error(directResult.error?.message ?? assignmentResult.error?.message);

    const directCourses: any[] = (directResult.data ?? []) as any[];
    classAssignments = (assignmentResult.data ?? []) as any[];
    convenorCourseIds = new Set(directCourses.map((course) => course.id));
    const classCourseIds = Array.from(new Set(classAssignments.map((item) => item.course_id)));
    const missingCourseIds = classCourseIds.filter((id) => !convenorCourseIds.has(id));
    let classCourses: any[] = [];
    if (missingCourseIds.length) {
      const { data, error } = await supabase.from('courses').select('*').in('id', missingCourseIds).order('code');
      if (error) throw new Error(error.message);
      classCourses = (data ?? []) as any[];
    }
    courses = [...directCourses, ...classCourses].sort((a, b) => String(a.code).localeCompare(String(b.code)));

    const sectionIds = Array.from(new Set(classAssignments.map((item) => item.class_section_id)));
    if (sectionIds.length) {
      const { data, error } = await (supabase as any).from('class_sections').select('id,name,cohort_id,year_of_study').in('id', sectionIds);
      if (error) throw new Error(error.message);
      classSections = (data ?? []) as any[];
    }

    const courseIds = courses.map((course) => course.id);
    if (courseIds.length) {
      const [enrollmentResult, testResult, materialResult] = await Promise.all([
        supabase.from('enrollments').select('*').in('course_id', courseIds).eq('status', 'active'),
        supabase.from('tests').select('*').in('course_id', courseIds),
        supabase.from('course_materials').select('*').in('course_id', courseIds).order('created_at', { ascending: false })
      ]);
      const error = enrollmentResult.error ?? testResult.error ?? materialResult.error;
      if (error) throw new Error(error.message);
      enrollments = (enrollmentResult.data ?? []) as any[];
      tests = (testResult.data ?? []) as any[];
      materials = (materialResult.data ?? []) as any[];
      const studentIds = Array.from(new Set(enrollments.map((item) => item.student_id)));
      const testIds = tests.map((item) => item.id);
      if (studentIds.length) {
        const { data, error: studentError } = await (supabase as any).from('profiles').select('id,full_name,email,registration_number,class_section_id').in('id', studentIds);
        if (studentError) throw new Error(studentError.message);
        students = (data ?? []) as any[];
      } else students = [];
      if (testIds.length) {
        const { data, error: attemptError } = await supabase.from('test_attempts').select('*').in('test_id', testIds);
        if (attemptError) throw new Error(attemptError.message);
        attempts = (data ?? []) as any[];
      } else attempts = [];
    } else {
      enrollments = [];
      students = [];
      tests = [];
      attempts = [];
      materials = [];
    }
  }

  const convenedCourses = courses.filter((course) => convenorCourseIds.has(course.id));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mipc-eyebrow">Teaching workspace</p><h1 className="mipc-page-title">Courses, classes and rosters</h1><p className="mt-2 max-w-2xl text-sm text-ink-700">Review the courses and classes you teach, student rosters and published resources. Lesson planning and new material uploads now have a dedicated workspace.</p></div>
        {convenedCourses.length > 0 && <Link href="/lecturer/tests/new" className="mipc-button-primary"><PlusIcon className="h-4 w-4" /> New assessment</Link>}
      </header>

      <section className="mipc-panel flex flex-col gap-4 border-l-4 border-l-mipc-green-700 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800"><BookOpenIcon className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-bold text-ink-950">Add lessons and teaching materials</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-600">Create a lesson/topic first, then attach books, notes, questionnaires, assignments, slides and other files to that lesson.</p></div></div>
        <Link href="/lecturer/lessons" className="mipc-button-primary shrink-0">Open Lessons & Materials</Link>
      </section>

      <div className="space-y-6">
        {courses.map((course) => {
          const courseEnrollments = enrollments.filter((item) => item.course_id === course.id);
          const courseStudents = students.filter((student) => courseEnrollments.some((item) => item.student_id === student.id));
          const courseTests = tests.filter((item) => item.course_id === course.id);
          const courseMaterials = materials.filter((item) => item.course_id === course.id);
          const courseClassAssignments = classAssignments.filter((item) => item.course_id === course.id);
          const assignedClasses = courseClassAssignments.map((item) => classSections.find((section) => section.id === item.class_section_id)).filter(Boolean);
          const isConvenor = convenorCourseIds.has(course.id);
          return <section key={course.id} className="mipc-panel overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-parchment-200 bg-parchment-50 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{course.code} · {course.credits} credits</p><h2 className="mt-1 font-display text-2xl font-bold text-ink-950">{course.title}</h2><div className="mt-2 flex flex-wrap gap-2">{isConvenor&&<span className="mipc-status">Course convenor</span>}{assignedClasses.map((section:any)=><span key={section.id} className="mipc-status">{section.name} · Year {section.year_of_study}</span>)}</div></div>{isConvenor&&<Link href={`/lecturer/tests/new?courseId=${course.id}`} className="mipc-button-secondary">Add assessment</Link>}</div>
            <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-2">
              <div><h3 className="mipc-label flex items-center gap-2"><BookOpenIcon className="h-4 w-4" /> Materials ({courseMaterials.length})</h3><div className="mt-3 space-y-3">{courseMaterials.map((material) => { const scopedClass:any = classSections.find((section)=>section.id===material.class_section_id); return <article key={material.id} className="rounded-xl border border-parchment-200 p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-mipc-green-700">{String(material.material_category ?? material.material_type ?? 'material').replaceAll('_',' ')}{scopedClass ? ` · ${scopedClass.name}` : ' · whole intake'}</p><p className="mt-1 font-semibold text-ink-950">{material.title}</p><p className="mt-1 text-xs text-ink-600">{material.description}</p></div><span className="mipc-status">{material.published ? 'Published' : 'Draft'}</span></div><div className="mt-3 flex flex-wrap gap-4">{material.storage_path && <a href={`/api/course-materials/${material.id}`} className="inline-flex text-sm font-bold text-mipc-green-700">Download {material.file_name ?? 'file'}</a>}{material.resource_url && <a href={material.resource_url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-bold text-mipc-navy-700">Open resource</a>}</div>{material.content && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-ink-600">{material.content}</p>}</article>})}{courseMaterials.length === 0 && <p className="text-sm text-ink-600">No lesson materials have been added yet.</p>}</div></div>
              <div><h3 className="mipc-label flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Visible roster ({courseStudents.length})</h3><p className="mt-1 text-xs text-ink-500">{isConvenor ? 'Cohort-wide roster for this course.' : `Limited to ${assignedClasses.map((section:any)=>section.name).join(', ') || 'your HOD-assigned class'}.`}</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-ink-500"><tr><th className="py-2">Student</th><th className="py-2">Email</th><th className="py-2">Class</th><th className="py-2">Attempts</th></tr></thead><tbody className="divide-y divide-parchment-200">{courseStudents.map((student) => { const completed = attempts.filter((attempt) => attempt.student_id === student.id && courseTests.some((test) => test.id === attempt.test_id)); const section:any=classSections.find((item)=>item.id===student.class_section_id); return <tr key={student.id}><td className="py-3 font-semibold text-ink-950">{student.full_name}</td><td className="py-3 text-ink-600">{student.email}</td><td className="py-3 text-ink-600">{section?.name??'—'}</td><td className="py-3 text-ink-600">{completed.length}</td></tr>; })}</tbody></table></div></div>
            </div>
          </section>;
        })}
        {courses.length === 0 && <div className="mipc-empty">No course or class teaching assignments are assigned to this lecturer account. An administrator must create a course/module before lessons can be added.</div>}
      </div>
    </div>
  );
}
