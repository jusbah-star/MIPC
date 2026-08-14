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
  MegaphoneIcon
} from '@/components/icons';

export default async function LecturerDashboard() {
  const currentLecturer = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'lecturer');
  const lecturerId = currentLecturer?.id ?? 'user-lecturer-1';
  let displayName = currentLecturer?.full_name ?? 'MIPC lecturer';
  let courses = dataStore.courses.filter((c) => c.lecturer_id === lecturerId);
  let convenorCourseIds = new Set(courses.map((course) => course.id));
  let classAssignments: any[] = [];
  let activeStudentCount = new Set(dataStore.enrollments.filter((item) => item.status === 'active' && courses.some((course)=>course.id===item.course_id)).map((item) => item.student_id)).size;
  let tests = dataStore.tests.filter((t) => courses.some((c) => c.id === t.course_id));
  let attempts = dataStore.test_attempts.filter((a) => tests.some((t) => t.id === a.test_id));
  let assignments = dataStore.assignments.filter((a) => courses.some((c) => c.id === a.course_id));
  let submissions = dataStore.submissions.filter((s) => assignments.some((a) => a.id === s.assignment_id));
  let pendingGrading = submissions.filter((s) => s.grade === null);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Lecturer authentication required.');
    const [profileResult, directCourseResult, classAssignmentResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('courses').select('*').eq('lecturer_id', user.id),
      (supabase as any).from('course_class_assignments').select('course_id,class_section_id').eq('lecturer_id', user.id)
    ]);
    if (profileResult.error || directCourseResult.error || classAssignmentResult.error) throw new Error(profileResult.error?.message ?? directCourseResult.error?.message ?? classAssignmentResult.error?.message);
    displayName = (profileResult.data as any).full_name;
    const directCourses:any[] = (directCourseResult.data ?? []) as any[];
    classAssignments = (classAssignmentResult.data ?? []) as any[];
    convenorCourseIds = new Set(directCourses.map((course)=>course.id));
    const classCourseIds = Array.from(new Set(classAssignments.map((item)=>item.course_id)));
    const missingCourseIds = classCourseIds.filter((id)=>!convenorCourseIds.has(id));
    let classCourses:any[]=[];
    if(missingCourseIds.length){
      const {data,error}=await supabase.from('courses').select('*').in('id',missingCourseIds);
      if(error) throw new Error(error.message);
      classCourses=(data??[]) as any[];
    }
    courses=[...directCourses,...classCourses].sort((a,b)=>String(a.code).localeCompare(String(b.code)));
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

  const convenedCourses = courses.filter((course)=>convenorCourseIds.has(course.id));
  const classOnlyCount = courses.filter((course)=>!convenorCourseIds.has(course.id)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-ink-950 to-ink-900 text-white rounded-2xl p-6 sm:p-8 shadow-academic border border-ink-800">
        <div>
          <span className="text-xs uppercase tracking-widest text-brass-400 font-semibold block mb-1">MIPC faculty workspace · Academic year 2026/2027</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Welcome, {displayName}</h1>
          <p className="mt-1 text-xs sm:text-sm text-white/70">Manage your convened courses and the class sections assigned to you by the HOD.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {convenedCourses.length>0&&<Link href="/lecturer/tests/new" className="rounded-lg bg-brass-500 px-4 py-2 text-xs sm:text-sm font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-sm flex items-center gap-1.5"><PlusIcon className="w-4 h-4" /><span>New Assessment</span></Link>}
          {convenedCourses.length>0&&<Link href="/lecturer/grading" className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4 text-brass-400" /><span>Grading Queue ({pendingGrading.length})</span></Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Teaching modules" value={courses.length} note={`${convenedCourses.length} convened · ${classOnlyCount} class-specific`} icon={<BookOpenIcon className="w-4 h-4 text-brass-600"/>}/>
        <Metric label="Visible students" value={activeStudentCount} note="Scoped to your course/class assignments" icon={<UsersIcon className="w-4 h-4 text-brass-600"/>}/>
        <Metric label="Examinations" value={tests.length} note={`${attempts.length} total attempts`} icon={<ClockIcon className="w-4 h-4 text-brass-600"/>}/>
        <Metric label="Pending marking" value={pendingGrading.length} note="Convened-course submissions" icon={<CheckCircleIcon className="w-4 h-4 text-brass-600"/>}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-ink-950">Assigned academic modules</h2><Link href="/lecturer/courses" className="text-xs text-mipc-green-700 hover:text-mipc-green-800 flex items-center gap-1 font-semibold"><span>View classes & rosters</span><ChevronRightIcon className="w-3.5 h-3.5" /></Link></div>
          <div className="space-y-4">
            {courses.map((course) => {
              const courseTests = tests.filter((t) => t.course_id === course.id);
              const courseAssignments = assignments.filter((a) => a.course_id === course.id);
              const isConvenor=convenorCourseIds.has(course.id);
              const assignedClassCount=classAssignments.filter((item)=>item.course_id===course.id).length;
              return <div key={course.id} className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs hover:border-brass-400/50 transition-colors"><div className="flex flex-wrap items-center justify-between gap-2 mb-2"><span className="text-xs font-bold text-mipc-green-700 bg-mipc-green-50 px-2.5 py-0.5 rounded">{course.code}</span><span className="mipc-status">{isConvenor?'Course convenor':`${assignedClassCount} class assignment${assignedClassCount===1?'':'s'}`}</span></div><h3 className="font-display text-xl font-bold text-ink-950 mb-2">{course.title}</h3><p className="text-sm text-ink-700 leading-relaxed mb-4">{course.description}</p><div className="pt-4 border-t border-parchment-200 flex flex-wrap items-center justify-between gap-3 text-xs"><div className="flex items-center gap-3 text-ink-600"><span>{courseTests.length} exams visible</span><span>·</span><span>{courseAssignments.length} assignments visible</span></div><Link href="/lecturer/courses" className="bg-ink-900 text-white px-3 py-1.5 rounded hover:bg-ink-800 transition-colors">Open roster</Link></div></div>;
            })}
            {courses.length===0&&<div className="mipc-empty">No course or class teaching assignments have been assigned yet.</div>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs"><h3 className="font-display text-base font-bold text-ink-950 mb-4">Faculty tools</h3><div className="space-y-2"><Link href="/lecturer/courses" className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-medium text-ink-900"><div className="flex items-center gap-2.5"><UsersIcon className="w-4 h-4 text-brass-600"/><span>View class rosters</span></div><ChevronRightIcon className="w-3.5 h-3.5 text-ink-400"/></Link>{convenedCourses.length>0&&<Link href="/lecturer/tests/new" className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-medium text-ink-900"><div className="flex items-center gap-2.5"><PlusIcon className="w-4 h-4 text-brass-600"/><span>Create cohort assessment</span></div><ChevronRightIcon className="w-3.5 h-3.5 text-ink-400"/></Link>}{convenedCourses.length>0&&<Link href="/lecturer/grading" className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-medium text-ink-900"><div className="flex items-center gap-2.5"><CheckCircleIcon className="w-4 h-4 text-brass-600"/><span>Mark coursework</span></div><ChevronRightIcon className="w-3.5 h-3.5 text-ink-400"/></Link>}<Link href="/lecturer/announcements" className="w-full flex items-center justify-between p-3 rounded-lg border border-parchment-300 hover:bg-parchment-100 transition-colors text-xs font-medium text-ink-900"><div className="flex items-center gap-2.5"><MegaphoneIcon className="w-4 h-4 text-brass-600"/><span>Publish academic bulletin</span></div><ChevronRightIcon className="w-3.5 h-3.5 text-ink-400"/></Link></div></div>
          <div className="bg-parchment-100/70 rounded-xl border border-parchment-300 p-5"><h4 className="font-display text-sm font-bold text-ink-950 mb-1">Class access boundary</h4><p className="text-xs text-ink-700 leading-relaxed">A class-specific assignment exposes only that class roster. Cohort-wide assessments and materials remain controlled by the course convenor.</p></div>
        </div>
      </div>
    </div>
  );
}

function Metric({label,value,note,icon}:{label:string;value:number;note:string;icon:React.ReactNode}){return <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs"><div className="flex items-center justify-between text-ink-500 mb-2"><span className="text-xs uppercase tracking-wider font-semibold">{label}</span>{icon}</div><div className="font-display text-2xl font-bold text-ink-950">{value}</div><p className="text-[11px] text-ink-600 mt-1">{note}</p></div>}
