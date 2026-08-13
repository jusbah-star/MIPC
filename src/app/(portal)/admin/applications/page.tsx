import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { approveApplication, enrollApprovedApplication, rejectApplication } from './actions';
import { CheckCircleIcon, AlertCircleIcon, UsersIcon } from '@/components/icons';

export default async function ApplicationsPage() {
  let applications: any[] = dataStore.applications;
  let departments: any[] = dataStore.departments;
  let cohorts: any[] = dataStore.cohorts;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [appsResult, departmentsResult, cohortsResult] = await Promise.all([
      (supabase as any).from('applications').select('id, full_name, email, phone, statement, status, department_id, submitted_at, enrolled_student_id, enrolled_at').order('submitted_at', { ascending: false }),
      (supabase as any).from('departments').select('id, name, code').order('name'),
      (supabase as any).from('cohorts').select('id, name, department_id, start_date').order('start_date', { ascending: false })
    ]);
    const error = appsResult.error ?? departmentsResult.error ?? cohortsResult.error;
    if (error) throw new Error('Admissions data could not be loaded.');
    applications = appsResult.data ?? [];
    departments = departmentsResult.data ?? [];
    cohorts = cohortsResult.data ?? [];
  }

  const pendingCount = applications.filter((a) => a.status === 'pending' || a.status === 'under_review').length;
  const approvedAwaitingEnrollment = applications.filter((a) => a.status === 'approved' && !a.enrolled_student_id).length;
  const enrolledCount = applications.filter((a) => a.enrolled_student_id).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mipc-eyebrow">Admissions & enrollment</p>
          <h1 className="mipc-page-title">Candidate admissions pipeline</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-700">Approve admission first, then complete the student's academic placement before creating their campus portal identity.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-signal-warn-bg px-3 py-1.5 text-signal-warn">{pendingCount} awaiting decision</span>
          <span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-mipc-green-800">{approvedAwaitingEnrollment} ready to enroll</span>
          <span className="rounded-full bg-mipc-navy-950 px-3 py-1.5 text-white">{enrolledCount} enrolled</span>
        </div>
      </header>

      <div className="grid gap-5">
        {applications.map((app) => {
          const isPending = app.status === 'pending' || app.status === 'under_review';
          const isApproved = app.status === 'approved';
          const isEnrolled = Boolean(app.enrolled_student_id);
          const suggestedDepartment = departments.find((item) => item.id === app.department_id);

          return (
            <article key={app.id} className="overflow-hidden rounded-[1.4rem] border border-mipc-navy-900/10 bg-white shadow-academic">
              <div className="p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl font-bold text-mipc-navy-950">{app.full_name}</h2>
                      {isPending && <span className="rounded-full bg-signal-warn-bg px-2.5 py-1 text-[10px] font-bold uppercase text-signal-warn">Awaiting decision</span>}
                      {isApproved && !isEnrolled && <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[10px] font-bold uppercase text-mipc-green-800">Approved · enrollment pending</span>}
                      {isEnrolled && <span className="inline-flex items-center gap-1 rounded-full bg-mipc-navy-950 px-2.5 py-1 text-[10px] font-bold uppercase text-white"><CheckCircleIcon className="h-3 w-3" /> Enrolled</span>}
                      {app.status === 'rejected' && <span className="rounded-full bg-signal-danger-bg px-2.5 py-1 text-[10px] font-bold uppercase text-signal-danger">Declined</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">{app.email}{app.phone ? ` · ${app.phone}` : ''}</p>
                    <p className="mt-1 text-xs text-ink-500">Applied {new Date(app.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{suggestedDepartment ? ` · Requested ${suggestedDepartment.name}` : ''}</p>
                  </div>
                  {isEnrolled && <Link href="/admin/students" className="mipc-button-secondary"><UsersIcon className="h-4 w-4" /> Open Student Registry</Link>}
                </div>

                {app.statement && <div className="mt-5 rounded-xl bg-[#f7f8f5] p-4 text-sm italic leading-6 text-ink-700">“{app.statement}”</div>}

                {isPending && (
                  <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-mipc-navy-900/10 pt-5">
                    <form action={rejectApplication.bind(null, app.id)}><button type="submit" className="mipc-button-secondary !border-signal-danger/25 !text-signal-danger">Decline admission</button></form>
                    <form action={approveApplication.bind(null, app.id)}><button type="submit" className="mipc-button-primary !bg-mipc-green-700"><CheckCircleIcon className="h-4 w-4" /> Approve admission</button></form>
                  </div>
                )}
              </div>

              {isApproved && !isEnrolled && (
                <div className="border-t border-mipc-navy-900/10 bg-[#f6f8f6] p-5 sm:p-7">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.17em] text-mipc-green-700">Enrollment setup</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-mipc-navy-950">Create the student's official academic identity</h3>
                    <p className="mt-1 text-sm text-ink-600">Assign the registration number and placement. Submitting this creates or completes the student's portal account.</p>
                  </div>
                  <form action={enrollApprovedApplication} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="application_id" value={app.id} />
                    <div><label className="mipc-label" htmlFor={`reg-${app.id}`}>Registration number</label><input id={`reg-${app.id}`} name="registration_number" className="mipc-field uppercase" placeholder="MIPC-2026-00125" required maxLength={40} /></div>
                    <div><label className="mipc-label" htmlFor={`dept-${app.id}`}>Department of study</label><select id={`dept-${app.id}`} name="department_id" className="mipc-field" defaultValue={app.department_id ?? ''} required><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
                    <div><label className="mipc-label" htmlFor={`cohort-${app.id}`}>Cohort / intake</label><select id={`cohort-${app.id}`} name="cohort_id" className="mipc-field" defaultValue=""><option value="">Assign later</option>{cohorts.map((cohort) => { const dept = departments.find((d) => d.id === cohort.department_id); return <option key={cohort.id} value={cohort.id}>{cohort.name}{dept ? ` · ${dept.code}` : ''}</option>; })}</select></div>
                    <div><label className="mipc-label" htmlFor={`year-${app.id}`}>Year of study</label><select id={`year-${app.id}`} name="year_of_study" className="mipc-field" defaultValue="1"><option value="">Assign later</option>{[1,2,3,4,5,6,7,8].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div>
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button type="submit" className="mipc-button-primary !bg-mipc-green-700"><UsersIcon className="h-4 w-4" /> Enroll student & create portal account</button></div>
                  </form>
                </div>
              )}
            </article>
          );
        })}

        {applications.length === 0 && <div className="rounded-2xl border border-dashed border-mipc-navy-900/15 bg-white p-12 text-center text-sm text-ink-500"><AlertCircleIcon className="mx-auto mb-3 h-6 w-6" />No applications recorded yet.</div>}
      </div>
    </div>
  );
}
