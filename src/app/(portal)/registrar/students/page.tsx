import { ShieldCheckIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { updateStudentRegistration } from '../actions';

export default async function RegistrarStudents({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim().toLowerCase() ?? '';

  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const [studentsResult, departmentsResult, cohortsResult, sectionsResult] = await Promise.all([
    (admin as any).from('profiles').select('id,full_name,email,registration_number,department_id,cohort_id,class_section_id,year_of_study,registration_status,account_status').eq('role','student').order('full_name'),
    admin.from('departments').select('id,name,code').order('name'),
    admin.from('cohorts').select('id,name,department_id').order('name'),
    (admin as any).from('class_sections').select('id,name,cohort_id,department_id,year_of_study').order('name')
  ]);
  if(studentsResult.error||departmentsResult.error||cohortsResult.error||sectionsResult.error) throw new Error('Student register could not be loaded.');

  const students:any[]=studentsResult.data??[];
  const departments:any[]=departmentsResult.data??[];
  const cohorts:any[]=cohortsResult.data??[];
  const sections:any[]=sectionsResult.data??[];
  const filteredStudents = query
    ? students.filter((student) => {
        const department = departments.find((item) => item.id === student.department_id);
        const cohort = cohorts.find((item) => item.id === student.cohort_id);
        const section = sections.find((item) => item.id === student.class_section_id);
        return [student.full_name,student.email,student.registration_number,department?.name,department?.code,cohort?.name,section?.name]
          .some((value) => String(value ?? '').toLowerCase().includes(query));
      })
    : students;

  return <div className="space-y-7"><header><p className="mipc-eyebrow">Registrar · authoritative student register</p><h1 className="mipc-page-title">Registered students</h1><p className="mt-2 max-w-3xl text-sm text-ink-700">Maintain registration identity and standing. Intake membership and HOD class placement are shown separately so one cohort can contain several teaching classes.</p></header>
    <section className="mipc-panel p-5 sm:p-6"><form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><label className="mipc-label" htmlFor="registrar-student-search">Find a student</label><input id="registrar-student-search" name="q" className="mipc-field" defaultValue={rawQuery??''} placeholder="Name, registration number, email, department, cohort or class" autoComplete="off"/></div><button className="mipc-button-primary !bg-mipc-green-700" type="submit">Search students</button>{query&&<a href="/registrar/students" className="mipc-button-secondary">Clear</a>}</form>{query&&<p className="mt-3 text-sm text-ink-600">{filteredStudents.length} match{filteredStudents.length===1?'':'es'} for <span className="font-semibold text-ink-950">“{rawQuery?.trim()}”</span>.</p>}</section>

    <div className="grid gap-4">{filteredStudents.map((student)=>{const department=departments.find((d)=>d.id===student.department_id); const cohort=cohorts.find((c)=>c.id===student.cohort_id); const section=sections.find((s)=>s.id===student.class_section_id); return <details key={student.id} className="mipc-panel overflow-hidden"><summary className="cursor-pointer list-none p-5 marker:content-none"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold text-ink-950">{student.full_name}</h2><span className="mipc-status">{student.registration_status??'registered'}</span></div><p className="mt-1 text-xs font-bold text-mipc-green-700">{student.registration_number}</p><p className="mt-1 text-sm text-ink-600">{department?.name??'No department'} · {student.year_of_study?`Year ${student.year_of_study}`:'Year not assigned'}</p></div><div className="text-sm text-ink-600"><p>{student.email}</p><p className="mt-1 text-xs font-semibold">Intake: {cohort?.name??'Not assigned'}</p><p className="mt-1 text-xs font-semibold">Class: {section?.name??'Awaiting HOD assignment'}</p></div></div></summary>
      <form action={updateStudentRegistration} className="grid gap-4 border-t border-parchment-200 bg-[#f8faf8] p-5 sm:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="student_id" value={student.id}/><div className="lg:col-span-2"><label className="mipc-label">Full legal name</label><input name="full_name" className="mipc-field" defaultValue={student.full_name} required/></div><div><label className="mipc-label">Registration number</label><input name="registration_number" className="mipc-field uppercase" defaultValue={student.registration_number??''} required/></div><div><label className="mipc-label">Email</label><input name="email" type="email" className="mipc-field" defaultValue={student.email} required/></div><div><label className="mipc-label">Department</label><select name="department_id" className="mipc-field" defaultValue={student.department_id??''} required>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="mipc-label">Year of study</label><select name="year_of_study" className="mipc-field" defaultValue={student.year_of_study?String(student.year_of_study):''}><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((y)=><option key={y} value={y}>Year {y}</option>)}</select></div><div><label className="mipc-label">Registration standing</label><select name="registration_status" className="mipc-field" defaultValue={student.registration_status??'registered'}><option value="provisional">Provisional</option><option value="registered">Registered</option><option value="deferred">Deferred</option><option value="withdrawn">Withdrawn</option><option value="graduated">Graduated</option></select></div><div><label className="mipc-label">Intake / cohort</label><div className="mipc-field flex items-center text-ink-600">{cohort?.name??'Not assigned'}</div></div><div><label className="mipc-label">HOD class</label><div className="mipc-field flex items-center text-ink-600">{section?.name??'Not assigned'}</div></div><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button className="mipc-button-primary !bg-mipc-green-700" type="submit"><ShieldCheckIcon className="h-4 w-4"/> Save registration</button></div></form>
    </details>})}{filteredStudents.length===0&&<div className="mipc-panel p-10 text-center text-sm text-ink-600">{query?'No students match this search. Try a name, registration number, email, department, cohort or class.':'No student registrations are recorded yet.'}</div>}</div></div>;
}
