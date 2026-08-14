import Link from 'next/link';
import { CheckCircleIcon, UsersIcon } from '@/components/icons';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { approveApplication, registerApprovedApplicant, rejectApplication, retryApplicationEmails } from '../actions';

export default async function RegistrarApplications() {
  const { admin } = await requireActiveGovernanceRole(['registrar','admin']);
  const [appsResult, departmentsResult, notificationsResult] = await Promise.all([
    admin.from('applications').select('id,full_name,email,phone,statement,status,department_id,submitted_at,enrolled_student_id,enrolled_at,secondary_field_of_study,national_exam_result,documents_path').order('submitted_at',{ascending:false}),
    admin.from('departments').select('id,name,code').order('name'),
    (admin as any).from('application_email_notifications').select('application_id,event,status,last_error,sent_at').order('created_at',{ascending:true})
  ]);
  if(appsResult.error||departmentsResult.error||notificationsResult.error) throw new Error('Admissions data could not be loaded.');
  const applications:any[]=appsResult.data??[];
  const departments:any[]=departmentsResult.data??[];
  const notifications:any[]=notificationsResult.data??[];

  return <div className="space-y-7">
    <header><p className="mipc-eyebrow">Registrar · admissions and registration</p><h1 className="mipc-page-title">Candidate registration pipeline</h1><p className="mt-2 max-w-3xl text-sm text-ink-700">Review each applicant's secondary-school evidence, approve or decline the application, then issue the registration number, department and year of study. The HOD assigns the class after registration.</p></header>

    <div className="grid gap-5">{applications.map((app)=>{
      const pending=['pending','under_review'].includes(app.status);
      const approved=app.status==='approved';
      const enrolled=Boolean(app.enrolled_student_id);
      const appNotifications=notifications.filter((item)=>item.application_id===app.id);
      const hasUnsent=appNotifications.some((item)=>item.status!=='sent');
      const requestedDepartment=departments.find((item)=>item.id===app.department_id);

      return <article key={app.id} className="mipc-panel overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold text-ink-950">{app.full_name}</h2><span className="mipc-status">{enrolled?'registered':app.status}</span></div><p className="mt-1 text-sm text-ink-600">{app.email}{app.phone?` · ${app.phone}`:''}</p><p className="mt-1 text-xs text-ink-500">Applied {new Date(app.submitted_at).toLocaleDateString('en-GB')}{requestedDepartment?` · Requested ${requestedDepartment.name}`:''}</p></div>
            <div className="flex flex-wrap items-start gap-2">{appNotifications.map((notification)=><span key={notification.event} title={notification.last_error||undefined} className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${notification.status==='sent'?'bg-mipc-green-50 text-mipc-green-800':notification.status==='failed'?'bg-signal-danger-bg text-signal-danger':'bg-signal-warn-bg text-signal-warn'}`}>{notification.event} email · {notification.status}</span>)}</div>
          </div>

          <div className="mt-5 grid gap-4 rounded-2xl border border-mipc-navy-900/10 bg-[#f7f8f5] p-5 sm:grid-cols-2">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Secondary studies</p><p className="mt-1 text-sm font-semibold text-mipc-navy-950">{app.secondary_field_of_study||'Legacy application · not recorded'}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">National exam result</p><p className="mt-1 text-sm font-semibold text-mipc-navy-950">{app.national_exam_result||'Legacy application · not recorded'}</p></div>
            <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">Secondary diploma</p>{app.documents_path?<Link href={`/api/admissions/document/${app.id}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-sm font-bold text-mipc-green-700 underline">Open private diploma evidence ↗</Link>:<p className="mt-1 text-sm text-ink-600">No diploma attached to this legacy application.</p>}</div>
          </div>

          {app.statement&&<p className="mt-4 rounded-xl bg-parchment-50 p-4 text-sm italic text-ink-700">“{app.statement}”</p>}

          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-parchment-200 pt-5">
            {hasUnsent&&<form action={retryApplicationEmails}><input type="hidden" name="application_id" value={app.id}/><button className="mipc-button-secondary" type="submit">Retry email</button></form>}
            {pending&&<><form action={rejectApplication}><input type="hidden" name="application_id" value={app.id}/><button className="mipc-button-secondary !text-signal-danger" type="submit">Decline</button></form><form action={approveApplication}><input type="hidden" name="application_id" value={app.id}/><button className="mipc-button-primary !bg-mipc-green-700" type="submit"><CheckCircleIcon className="h-4 w-4"/> Approve</button></form></>}
          </div>
        </div>

        {approved&&!enrolled&&<div className="border-t border-parchment-200 bg-[#f6f8f6] p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">Official registration</p><h3 className="mt-1 font-display text-xl font-bold text-ink-950">Create the registered student identity</h3><form action={registerApprovedApplicant} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><input type="hidden" name="application_id" value={app.id}/><div><label className="mipc-label">Registration number</label><input name="registration_number" className="mipc-field uppercase" required maxLength={40}/></div><div><label className="mipc-label">Department</label><select name="department_id" className="mipc-field" defaultValue={app.department_id??''} required><option value="" disabled>Select department</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div><label className="mipc-label">Year of study</label><select name="year_of_study" className="mipc-field" defaultValue="1">{[1,2,3,4,5,6,7,8].map((y)=><option key={y} value={y}>Year {y}</option>)}</select></div><div className="flex items-end"><button className="mipc-button-primary w-full !bg-mipc-green-700" type="submit"><UsersIcon className="h-4 w-4"/> Register student</button></div></form><p className="mt-3 text-xs text-ink-500">Class/cohort is intentionally not assigned here. The registered student will appear in the HOD workspace for class placement.</p></div>}
      </article>;
    })}{applications.length===0&&<div className="mipc-panel p-10 text-center text-sm text-ink-600">No applications recorded yet.</div>}</div>
  </div>;
}
