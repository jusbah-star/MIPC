import Link from 'next/link';
import { UsersIcon, ShieldCheckIcon, PlusIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { createStudent, updateStudent } from './actions';

type RegistryNoticeKey = 'student-created' | 'student-exists' | 'email-in-use' | 'registration-in-use';
type SearchParams = { notice?: string | string[]; student?: string | string[]; q?: string | string[]; department?: string | string[]; cohort?: string | string[]; page?: string | string[] };
const PAGE_SIZE = 50;

const REGISTRY_NOTICES: Record<RegistryNoticeKey, { title: string; body: string; tone: string }> = {
  'student-created': { title: 'Student account created', body: 'The student portal identity is active and ready to use.', tone: 'border-mipc-green-700/20 bg-mipc-green-50 text-mipc-green-900' },
  'student-exists': { title: 'Student already exists', body: 'No duplicate was created. Search the existing record below to review or update it.', tone: 'border-mipc-green-700/20 bg-[#f4f8f2] text-mipc-navy-950' },
  'email-in-use': { title: 'Email already belongs to another portal account', body: 'Use a different student email or review the existing account in the User Directory.', tone: 'border-signal-danger/20 bg-signal-danger-bg text-signal-danger' },
  'registration-in-use': { title: 'Registration number already assigned', body: 'Choose the student who already owns that registration number or enter a different registration number.', tone: 'border-signal-danger/20 bg-signal-danger-bg text-signal-danger' }
};

function scalar(value:string|string[]|undefined) { return Array.isArray(value) ? value[0] ?? '' : value ?? ''; }
function safeSearch(value:string) { return value.replace(/[,%()'"*]/g,' ').replace(/\s+/g,' ').trim().slice(0,80); }

export default async function StudentRegistryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const noticeKeyRaw = scalar(params.notice);
  const highlightedStudentId = scalar(params.student);
  const query = safeSearch(scalar(params.q));
  const requestedPage = Math.max(1, Number.parseInt(scalar(params.page) || '1', 10) || 1);
  const notice = noticeKeyRaw && noticeKeyRaw in REGISTRY_NOTICES ? REGISTRY_NOTICES[noticeKeyRaw as RegistryNoticeKey] : null;
  const { admin } = await requireActiveGovernanceRole(['admin']);

  const [departmentResult, cohortResult, totalResult, activeResult, registeredNumberResult] = await Promise.all([
    admin.from('departments').select('id,name,code').order('name'),
    admin.from('cohorts').select('id,name,department_id,start_date,end_date').order('start_date', { ascending: false }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role','student'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role','student').eq('account_status','active'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role','student').not('registration_number','is',null)
  ]);
  const baseError = departmentResult.error ?? cohortResult.error ?? totalResult.error ?? activeResult.error ?? registeredNumberResult.error;
  if (baseError) throw new Error(baseError.message);

  const departmentRows:any[] = departmentResult.data ?? [];
  const cohortRows:any[] = cohortResult.data ?? [];
  const departmentId = departmentRows.some((item)=>item.id===scalar(params.department)) ? scalar(params.department) : '';
  const cohortId = cohortRows.some((item)=>item.id===scalar(params.cohort)) ? scalar(params.cohort) : '';

  function buildRowsQuery() {
    let q:any = admin.from('profiles').select('id,full_name,email,registration_number,department_id,cohort_id,year_of_study,account_status,created_at', { count:'exact' }).eq('role','student');
    if (query) q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,registration_number.ilike.%${query}%`);
    if (departmentId) q = q.eq('department_id',departmentId);
    if (cohortId) q = q.eq('cohort_id',cohortId);
    return q;
  }

  const filteredCountResult = await buildRowsQuery().select('id', { count:'exact', head:true });
  if (filteredCountResult.error) throw new Error(filteredCountResult.error.message);
  const filteredTotal = filteredCountResult.count ?? 0;
  const totalPages = Math.max(1,Math.ceil(filteredTotal/PAGE_SIZE));
  const page = Math.min(requestedPage,totalPages);
  const from = (page-1)*PAGE_SIZE;
  const rowResult = await buildRowsQuery().order('full_name').range(from,from+PAGE_SIZE-1);
  if (rowResult.error) throw new Error(rowResult.error.message);
  let rows:any[] = rowResult.data ?? [];

  if (highlightedStudentId && !rows.some((row)=>row.id===highlightedStudentId)) {
    const highlightedResult = await admin.from('profiles').select('id,full_name,email,registration_number,department_id,cohort_id,year_of_study,account_status,created_at').eq('id',highlightedStudentId).eq('role','student').maybeSingle();
    if (!highlightedResult.error && highlightedResult.data) rows = [highlightedResult.data as any,...rows];
  }

  function pageHref(nextPage:number) {
    const sp=new URLSearchParams(); if(query)sp.set('q',query); if(departmentId)sp.set('department',departmentId); if(cohortId)sp.set('cohort',cohortId); if(nextPage>1)sp.set('page',String(nextPage)); const qs=sp.toString(); return `/admin/students${qs?`?${qs}`:''}`;
  }

  return <div className="space-y-8">
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="mipc-eyebrow">Office of the Academic Registrar</p><h1 className="mipc-page-title">Student Registry</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">Create official student accounts and manage large registries with server-side search and 50-row pages.</p></div><div className="flex flex-wrap gap-3 text-sm"><span className="mipc-status"><UsersIcon className="mr-2 h-4 w-4" />{totalResult.count ?? 0} students</span><span className="mipc-status">{activeResult.count ?? 0} active</span><span className="mipc-status">{registeredNumberResult.count ?? 0} reg. numbers assigned</span></div></header>

    {notice && <div role="status" className={`rounded-2xl border px-5 py-4 shadow-sm ${notice.tone}`}><p className="font-display text-lg font-bold">{notice.title}</p><p className="mt-1 text-sm leading-6 opacity-80">{notice.body}</p></div>}

    <section className="overflow-hidden rounded-[1.5rem] border border-mipc-navy-900/10 bg-white shadow-academic"><div className="grid gap-0 lg:grid-cols-[.7fr_1.3fr]"><div className="bg-mipc-navy-950 p-6 text-white sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-full bg-mipc-green-700"><PlusIcon className="h-5 w-5" /></span><h2 className="mt-6 font-display text-3xl font-bold">Register a student</h2><p className="mt-3 text-sm leading-6 text-white/70">Create the student portal identity and academic record without loading the full registry.</p><div className="mt-7 space-y-3 text-sm text-white/70"><p>• Registration numbers must be unique.</p><p>• Cohorts must match the selected department.</p><p>• New accounts are active by default.</p><p>• Registry changes are recorded in the audit log.</p></div></div>
      <form action={createStudent} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8"><div className="sm:col-span-2"><label className="mipc-label">Full legal name</label><input className="mipc-field" name="full_name" required maxLength={160}/></div><div><label className="mipc-label">Registration number</label><input className="mipc-field uppercase" name="registration_number" required maxLength={40} placeholder="MIPC-2026-00125"/></div><div><label className="mipc-label">Login email</label><input className="mipc-field" name="email" type="email" required maxLength={320}/></div><div><label className="mipc-label">Department of study</label><select className="mipc-field" name="department_id" defaultValue=""><option value="">Not assigned yet</option>{departmentRows.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="mipc-label">Cohort / intake</label><select className="mipc-field" name="cohort_id" defaultValue=""><option value="">Not assigned yet</option>{cohortRows.map((c)=>{const d=departmentRows.find((item)=>item.id===c.department_id);return <option key={c.id} value={c.id}>{c.name}{d?` · ${d.code}`:''}</option>})}</select></div><div><label className="mipc-label">Year of study</label><select className="mipc-field" name="year_of_study" defaultValue=""><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((year)=><option key={year} value={year}>Year {year}</option>)}</select></div><div className="flex items-end"><button type="submit" className="mipc-button-primary w-full !bg-mipc-green-700"><PlusIcon className="h-4 w-4"/> Create student account</button></div></form>
    </div></section>

    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-bold text-mipc-navy-950">Registered students</h2><p className="mt-1 text-sm text-ink-600">Only the current 50-row page is loaded.</p></div><Link href="/admin/audit" className="mipc-button-secondary"><ShieldCheckIcon className="h-4 w-4"/> View audit trail</Link></div>
      <div className="mipc-panel p-5 sm:p-6"><form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="md:col-span-2"><label className="mipc-label">Find a student</label><input name="q" className="mipc-field" defaultValue={query} placeholder="Name, registration number or email" autoComplete="off"/></div><div><label className="mipc-label">Department</label><select name="department" className="mipc-field" defaultValue={departmentId}><option value="">All departments</option>{departmentRows.map((d)=><option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</select></div><div><label className="mipc-label">Cohort</label><select name="cohort" className="mipc-field" defaultValue={cohortId}><option value="">All cohorts</option>{cohortRows.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="md:col-span-2 xl:col-span-4 flex gap-2"><button className="mipc-button-primary !bg-mipc-green-700" type="submit">Apply filters</button><Link href="/admin/students" className="mipc-button-secondary">Reset</Link></div></form><p className="mt-3 text-sm text-ink-600">{filteredTotal} matching · showing {filteredTotal===0?0:from+1}–{Math.min(from+(rowResult.data?.length??0),filteredTotal)}</p></div>

      <div className="grid gap-4">{rows.map((student)=>{const department=departmentRows.find((item)=>item.id===student.department_id);const cohort=cohortRows.find((item)=>item.id===student.cohort_id);return <details key={student.id} id={`student-${student.id}`} open={highlightedStudentId===student.id} className="group overflow-hidden rounded-2xl border border-mipc-navy-900/10 bg-white shadow-sm"><summary className="cursor-pointer list-none p-5 marker:content-none sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold text-mipc-navy-950">{student.full_name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${student.account_status==='active'?'bg-mipc-green-50 text-mipc-green-800':'bg-signal-danger-bg text-signal-danger'}`}>{student.account_status}</span></div><p className="mt-1 font-mono text-xs font-bold text-mipc-green-700">{student.registration_number||'Registration number not assigned'}</p><p className="mt-2 text-sm text-ink-600">{department?.name??'Department not assigned'}{cohort?` · ${cohort.name}`:''}{student.year_of_study?` · Year ${student.year_of_study}`:''}</p></div><div className="text-left sm:text-right"><p className="text-sm font-semibold text-ink-800">{student.email}</p><p className="mt-1 text-xs text-ink-500">Open to edit record</p></div></div></summary>
        <form action={updateStudent} className="grid gap-5 border-t border-mipc-navy-900/10 bg-[#f8faf8] p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4"><input type="hidden" name="student_id" value={student.id}/><div className="lg:col-span-2"><label className="mipc-label">Full legal name</label><input className="mipc-field" name="full_name" defaultValue={student.full_name} required/></div><div><label className="mipc-label">Registration number</label><input className="mipc-field uppercase" name="registration_number" defaultValue={student.registration_number??''} required/></div><div><label className="mipc-label">Login email</label><input className="mipc-field" name="email" type="email" defaultValue={student.email} required/></div><div><label className="mipc-label">Department</label><select className="mipc-field" name="department_id" defaultValue={student.department_id??''}><option value="">Not assigned</option>{departmentRows.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label className="mipc-label">Cohort / intake</label><select className="mipc-field" name="cohort_id" defaultValue={student.cohort_id??''}><option value="">Not assigned</option>{cohortRows.map((item)=>{const dept=departmentRows.find((d)=>d.id===item.department_id);return <option key={item.id} value={item.id}>{item.name}{dept?` · ${dept.code}`:''}</option>})}</select></div><div><label className="mipc-label">Year of study</label><select className="mipc-field" name="year_of_study" defaultValue={student.year_of_study?String(student.year_of_study):''}><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((year)=><option key={year} value={year}>Year {year}</option>)}</select></div><div><label className="mipc-label">Portal status</label><select className="mipc-field" name="account_status" defaultValue={student.account_status}><option value="active">Active</option><option value="suspended">Suspended</option></select></div><div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button type="submit" className="mipc-button-primary !bg-mipc-green-700"><ShieldCheckIcon className="h-4 w-4"/> Save student record</button></div></form>
      </details>})}{rows.length===0&&<div className="rounded-2xl border border-dashed border-mipc-navy-900/15 bg-white p-10 text-center text-sm text-ink-600">No students match the current filters.</div>}</div>

      {totalPages>1&&<nav className="flex items-center justify-between gap-3"><Link className={`mipc-button-secondary ${page<=1?'pointer-events-none opacity-40':''}`} href={pageHref(Math.max(1,page-1))}>← Previous</Link><span className="text-sm font-semibold text-ink-700">Page {page} of {totalPages}</span><Link className={`mipc-button-secondary ${page>=totalPages?'pointer-events-none opacity-40':''}`} href={pageHref(Math.min(totalPages,page+1))}>Next →</Link></nav>}
    </section>
  </div>;
}
