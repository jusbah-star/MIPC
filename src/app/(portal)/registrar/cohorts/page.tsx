import { PlusIcon, UsersIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { createRegistrarCohort } from '../actions';

export default async function RegistrarCohortsPage() {
  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const [cohortResult, departmentResult, studentResult, sectionResult] = await Promise.all([
    admin.from('cohorts').select('id,name,department_id,start_date,end_date').order('start_date',{ascending:false}),
    admin.from('departments').select('id,name,code').order('name'),
    (admin as any).from('profiles').select('id,cohort_id,class_section_id').eq('role','student'),
    (admin as any).from('class_sections').select('id,cohort_id,name,year_of_study,capacity,is_active')
  ]);
  const error=cohortResult.error||departmentResult.error||studentResult.error||sectionResult.error;
  if(error) throw new Error('Cohort register could not be loaded.');
  const cohorts:any[]=cohortResult.data??[];
  const departments:any[]=departmentResult.data??[];
  const students:any[]=studentResult.data??[];
  const sections:any[]=sectionResult.data??[];

  return <div className="space-y-8">
    <header><p className="mipc-eyebrow">Registrar · intake management</p><h1 className="mipc-page-title">Cohorts and intakes</h1><p className="mt-2 max-w-3xl text-sm text-ink-700">The Registrar creates the official intake/cohort. The HOD then divides registered students within that intake into class sections such as Class A, Class B and Class C.</p></header>

    <section className="mipc-panel overflow-hidden">
      <div className="grid lg:grid-cols-[.75fr_1.25fr]">
        <div className="bg-mipc-navy-950 p-6 text-white sm:p-8"><span className="grid h-11 w-11 place-items-center rounded-full bg-mipc-green-700"><PlusIcon className="h-5 w-5"/></span><h2 className="mt-5 font-display text-2xl font-bold">Open a new intake</h2><p className="mt-3 text-sm leading-6 text-white/70">Create one cohort for the intake. Do not create separate cohorts just to split a large class; HOD class sections handle that.</p></div>
        <form action={createRegistrarCohort} className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
          <div className="sm:col-span-2"><label className="mipc-label">Cohort / intake name</label><input className="mipc-field" name="name" required maxLength={180} placeholder="Civil Engineering · September 2026"/></div>
          <div className="sm:col-span-2"><label className="mipc-label">Department</label><select className="mipc-field" name="department_id" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department)=><option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
          <div><label className="mipc-label">Start date</label><input className="mipc-field" name="start_date" type="date" required/></div>
          <div><label className="mipc-label">Expected end date</label><input className="mipc-field" name="end_date" type="date"/></div>
          <div className="sm:col-span-2"><button className="mipc-button-primary w-full !bg-mipc-green-700" type="submit"><PlusIcon className="h-4 w-4"/> Create cohort</button></div>
        </form>
      </div>
    </section>

    <section className="mipc-panel overflow-hidden"><div className="border-b border-parchment-200 p-5"><h2 className="font-display text-xl font-bold text-ink-950">Official cohort register</h2><p className="mt-1 text-sm text-ink-600">Student count is intake membership; class count shows how HOD has divided the cohort.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600"><tr><th className="px-5 py-3">Cohort</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Students</th><th className="px-5 py-3">Classes</th><th className="px-5 py-3">Dates</th></tr></thead><tbody className="divide-y divide-parchment-200">{cohorts.map((cohort)=>{const cohortStudents=students.filter((student)=>student.cohort_id===cohort.id).length; const cohortSections=sections.filter((section)=>section.cohort_id===cohort.id&&section.is_active); const department=departments.find((item)=>item.id===cohort.department_id); return <tr key={cohort.id}><td className="px-5 py-4"><p className="font-semibold text-ink-950">{cohort.name}</p><p className="mt-1 text-xs text-ink-500">{cohortSections.map((section)=>`${section.name} (Y${section.year_of_study})`).join(' · ')||'No HOD classes yet'}</p></td><td className="px-5 py-4 text-ink-700">{department?.name??'Not assigned'}</td><td className="px-5 py-4"><span className="mipc-status"><UsersIcon className="mr-1 h-4 w-4"/>{cohortStudents}</span></td><td className="px-5 py-4 text-ink-700">{cohortSections.length}</td><td className="px-5 py-4 text-ink-700">{cohort.start_date} → {cohort.end_date??'Open'}</td></tr>})}</tbody></table></div>{cohorts.length===0&&<p className="p-8 text-center text-sm text-ink-600">No cohorts have been opened yet.</p>}</section>
  </div>;
}
