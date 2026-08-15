import Link from 'next/link';
import { ShieldCheckIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { updateStudentRegistration } from '../actions';

type SearchParams = { q?: string | string[]; department?: string | string[]; cohort?: string | string[]; class?: string | string[]; page?: string | string[] };
const PAGE_SIZE = 50;

function scalar(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function safeSearch(value: string) { return value.replace(/[,%()'"*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }

export default async function RegistrarStudents({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = safeSearch(scalar(params.q));
  const requestedPage = Math.max(1, Number.parseInt(scalar(params.page) || '1', 10) || 1);
  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);

  const [departmentsResult, cohortsResult, sectionsResult] = await Promise.all([
    admin.from('departments').select('id,name,code').order('name'),
    admin.from('cohorts').select('id,name,department_id').order('name'),
    (admin as any).from('class_sections').select('id,name,cohort_id,department_id,year_of_study').order('name')
  ]);
  if (departmentsResult.error || cohortsResult.error || sectionsResult.error) throw new Error('Student register filters could not be loaded.');
  const departments:any[] = departmentsResult.data ?? [];
  const cohorts:any[] = cohortsResult.data ?? [];
  const sections:any[] = sectionsResult.data ?? [];

  const departmentId = departments.some((item)=>item.id===scalar(params.department)) ? scalar(params.department) : '';
  const cohortId = cohorts.some((item)=>item.id===scalar(params.cohort)) ? scalar(params.cohort) : '';
  const classId = sections.some((item)=>item.id===scalar(params.class)) ? scalar(params.class) : '';

  function buildStudentQuery() {
    let dbQuery:any = (admin as any).from('profiles')
      .select('id,full_name,email,registration_number,department_id,cohort_id,class_section_id,year_of_study,registration_status,account_status', { count: 'exact' })
      .eq('role','student');
    if (query) dbQuery = dbQuery.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,registration_number.ilike.%${query}%`);
    if (departmentId) dbQuery = dbQuery.eq('department_id', departmentId);
    if (cohortId) dbQuery = dbQuery.eq('cohort_id', cohortId);
    if (classId) dbQuery = dbQuery.eq('class_section_id', classId);
    return dbQuery;
  }

  const countResult = await buildStudentQuery().select('id', { count: 'exact', head: true });
  if (countResult.error) throw new Error('Student register could not be counted.');
  const total = countResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * PAGE_SIZE;
  const studentsResult = await buildStudentQuery().order('full_name').range(from, from + PAGE_SIZE - 1);
  if (studentsResult.error) throw new Error('Student register could not be loaded.');
  const students:any[] = studentsResult.data ?? [];

  function pageHref(nextPage:number) {
    const sp = new URLSearchParams();
    if (query) sp.set('q', query);
    if (departmentId) sp.set('department', departmentId);
    if (cohortId) sp.set('cohort', cohortId);
    if (classId) sp.set('class', classId);
    if (nextPage > 1) sp.set('page', String(nextPage));
    const qs = sp.toString();
    return `/registrar/students${qs ? `?${qs}` : ''}`;
  }

  return <div className="space-y-7">
    <header><p className="mipc-eyebrow">Registrar · authoritative student register</p><h1 className="mipc-page-title">Registered students</h1><p className="mt-2 max-w-3xl text-sm text-ink-700">The register is server-paginated so thousands of student records do not load into one page. Search identity fields or narrow the list by department, intake and class.</p></header>

    <section className="mipc-panel p-5 sm:p-6">
      <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="md:col-span-2"><label className="mipc-label" htmlFor="registrar-student-search">Find a student</label><input id="registrar-student-search" name="q" className="mipc-field" defaultValue={query} placeholder="Name, registration number or email" autoComplete="off" /></div>
        <div><label className="mipc-label">Department</label><select name="department" className="mipc-field" defaultValue={departmentId}><option value="">All departments</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></div>
        <div><label className="mipc-label">Intake</label><select name="cohort" className="mipc-field" defaultValue={cohortId}><option value="">All intakes</option>{cohorts.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="mipc-label">Class</label><select name="class" className="mipc-field" defaultValue={classId}><option value="">All classes</option>{sections.map((s)=><option key={s.id} value={s.id}>{s.name} · Y{s.year_of_study}</option>)}</select></div>
        <div className="md:col-span-2 xl:col-span-5 flex gap-2"><button className="mipc-button-primary !bg-mipc-green-700" type="submit">Apply filters</button><Link href="/registrar/students" className="mipc-button-secondary">Reset</Link></div>
      </form>
      <p className="mt-3 text-sm text-ink-600">{total} matching student{total===1?'':'s'} · showing {total === 0 ? 0 : from + 1}–{Math.min(from + students.length, total)}</p>
    </section>

    <div className="grid gap-4">{students.map((student)=>{const department=departments.find((d)=>d.id===student.department_id); const cohort=cohorts.find((c)=>c.id===student.cohort_id); const section=sections.find((s)=>s.id===student.class_section_id); return <details key={student.id} className="mipc-panel overflow-hidden"><summary className="cursor-pointer list-none p-5 marker:content-none"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold text-ink-950">{student.full_name}</h2><span className="mipc-status">{student.registration_status??'registered'}</span></div><p className="mt-1 text-xs font-bold text-mipc-green-700">{student.registration_number}</p><p className="mt-1 text-sm text-ink-600">{department?.name??'No department'} · {student.year_of_study?`Year ${student.year_of_study}`:'Year not assigned'}</p></div><div className="text-sm text-ink-600"><p>{student.email}</p><p className="mt-1 text-xs font-semibold">Intake: {cohort?.name??'Not assigned'}</p><p className="mt-1 text-xs font-semibold">Class: {section?.name??'Awaiting HOD assignment'}</p></div></div></summary>
      <form action={updateStudentRegistration} className="grid gap-4 border-t border-parchment-200 bg-[#f8faf8] p-5 sm:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="student_id" value={student.id}/><div className="lg:col-span-2"><label className="mipc-label">Full legal name</label><input name="full_name" className="mipc-field" defaultValue={student.full_name} required/></div><div><label className="mipc-label">Registration number</label><input name="registration_number" className="mipc-field uppercase" defaultValue={student.registration_number??''} required/></div><div><label className="mipc-label">Email</label><input name="email" type="email" className="mipc-field" defaultValue={student.email} required/></div><div><label className="mipc-label">Department</label><select name="department_id" className="mipc-field" defaultValue={student.department_id??''} required>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="mipc-label">Year of study</label><select name="year_of_study" className="mipc-field" defaultValue={student.year_of_study?String(student.year_of_study):''}><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((y)=><option key={y} value={y}>Year {y}</option>)}</select></div><div><label className="mipc-label">Registration standing</label><select name="registration_status" className="mipc-field" defaultValue={student.registration_status??'registered'}><option value="provisional">Provisional</option><option value="registered">Registered</option><option value="deferred">Deferred</option><option value="withdrawn">Withdrawn</option><option value="graduated">Graduated</option></select></div><div><label className="mipc-label">Intake / cohort</label><div className="mipc-field flex items-center text-ink-600">{cohort?.name??'Not assigned'}</div></div><div><label className="mipc-label">HOD class</label><div className="mipc-field flex items-center text-ink-600">{section?.name??'Not assigned'}</div></div><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button className="mipc-button-primary !bg-mipc-green-700" type="submit"><ShieldCheckIcon className="h-4 w-4"/> Save registration</button></div></form>
    </details>})}{students.length===0&&<div className="mipc-panel p-10 text-center text-sm text-ink-600">No students match the current filters.</div>}</div>

    {totalPages > 1 && <nav className="flex items-center justify-between gap-3"><Link aria-disabled={page<=1} className={`mipc-button-secondary ${page<=1?'pointer-events-none opacity-40':''}`} href={pageHref(Math.max(1,page-1))}>← Previous</Link><span className="text-sm font-semibold text-ink-700">Page {page} of {totalPages}</span><Link aria-disabled={page>=totalPages} className={`mipc-button-secondary ${page>=totalPages?'pointer-events-none opacity-40':''}`} href={pageHref(Math.min(totalPages,page+1))}>Next →</Link></nav>}
  </div>;
}
