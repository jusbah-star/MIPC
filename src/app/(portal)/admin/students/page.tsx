import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { UsersIcon, ShieldCheckIcon, PlusIcon } from '@/components/icons';
import { createStudent, updateStudent } from './actions';

type RegistryNoticeKey = 'student-created' | 'student-exists' | 'email-in-use' | 'registration-in-use';

const REGISTRY_NOTICES: Record<RegistryNoticeKey, { title: string; body: string; tone: string }> = {
  'student-created': {
    title: 'Student account created',
    body: 'The student portal identity is active and ready to use.',
    tone: 'border-mipc-green-700/20 bg-mipc-green-50 text-mipc-green-900'
  },
  'student-exists': {
    title: 'Student already exists',
    body: 'No duplicate was created. The existing student record is opened below so you can review or update it.',
    tone: 'border-mipc-green-700/20 bg-[#f4f8f2] text-mipc-navy-950'
  },
  'email-in-use': {
    title: 'Email already belongs to another portal account',
    body: 'Use a different student email or review the existing account in the User Directory.',
    tone: 'border-signal-danger/20 bg-signal-danger-bg text-signal-danger'
  },
  'registration-in-use': {
    title: 'Registration number already assigned',
    body: 'Choose the student who already owns that registration number or enter a different registration number.',
    tone: 'border-signal-danger/20 bg-signal-danger-bg text-signal-danger'
  }
};

export default async function StudentRegistryPage({
  searchParams
}: {
  searchParams: Promise<{ notice?: string | string[]; student?: string | string[] }>;
}) {
  const params = await searchParams;
  const noticeKeyRaw = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const highlightedStudentId = Array.isArray(params.student) ? params.student[0] : params.student;
  const notice = noticeKeyRaw && noticeKeyRaw in REGISTRY_NOTICES
    ? REGISTRY_NOTICES[noticeKeyRaw as RegistryNoticeKey]
    : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: students, error: studentError }, { data: departments, error: departmentError }, { data: cohorts, error: cohortError }] = await Promise.all([
    (supabase as any).from('profiles').select('id, full_name, email, registration_number, department_id, cohort_id, year_of_study, account_status, created_at').eq('role', 'student').order('full_name'),
    (supabase as any).from('departments').select('id, name, code').order('name'),
    (supabase as any).from('cohorts').select('id, name, department_id, start_date, end_date').order('start_date', { ascending: false })
  ]);
  const error = studentError ?? departmentError ?? cohortError;
  if (error) throw new Error(error.message);

  const rows: any[] = (students ?? []) as any[];
  const departmentRows: any[] = (departments ?? []) as any[];
  const cohortRows: any[] = (cohorts ?? []) as any[];
  const activeCount = rows.filter((student) => student.account_status === 'active').length;
  const assignedCount = rows.filter((student) => student.registration_number).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mipc-eyebrow">Office of the Academic Registrar</p>
          <h1 className="mipc-page-title">Student Registry</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-700">Create official student portal accounts and maintain the academic identity used across admissions, login, cohorts and course access.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="mipc-status"><UsersIcon className="mr-2 h-4 w-4" />{rows.length} students</span>
          <span className="mipc-status">{activeCount} active</span>
          <span className="mipc-status">{assignedCount} reg. numbers assigned</span>
        </div>
      </header>

      {notice && (
        <div role="status" className={`rounded-2xl border px-5 py-4 shadow-sm ${notice.tone}`}>
          <p className="font-display text-lg font-bold">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{notice.body}</p>
        </div>
      )}

      <section className="overflow-hidden rounded-[1.5rem] border border-mipc-navy-900/10 bg-white shadow-academic">
        <div className="grid gap-0 lg:grid-cols-[.7fr_1.3fr]">
          <div className="bg-mipc-navy-950 p-6 text-white sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-mipc-green-700"><PlusIcon className="h-5 w-5" /></span>
            <h2 className="mt-6 font-display text-3xl font-bold">Register a student</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">This creates the student's MIPC portal identity. Their registration number and email are used to verify the account before a secure sign-in link is sent.</p>
            <div className="mt-7 space-y-3 text-sm text-white/70">
              <p>• Registration numbers must be unique.</p>
              <p>• Cohorts must match the selected department.</p>
              <p>• New accounts are active by default.</p>
              <p>• All registry changes are recorded in the audit log.</p>
            </div>
          </div>

          <form action={createStudent} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
            <div className="sm:col-span-2"><label className="mipc-label" htmlFor="new-full-name">Full legal name</label><input className="mipc-field" id="new-full-name" name="full_name" required maxLength={160} /></div>
            <div><label className="mipc-label" htmlFor="new-reg">Registration number</label><input className="mipc-field uppercase" id="new-reg" name="registration_number" required maxLength={40} placeholder="MIPC-2026-00125" /></div>
            <div><label className="mipc-label" htmlFor="new-email">Login email</label><input className="mipc-field" id="new-email" name="email" type="email" required maxLength={320} /></div>
            <div><label className="mipc-label" htmlFor="new-dept">Department of study</label><select className="mipc-field" id="new-dept" name="department_id" defaultValue=""><option value="">Not assigned yet</option>{departmentRows.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
            <div><label className="mipc-label" htmlFor="new-cohort">Cohort / intake</label><select className="mipc-field" id="new-cohort" name="cohort_id" defaultValue=""><option value="">Not assigned yet</option>{cohortRows.map((cohort) => { const dept: any = departmentRows.find((d) => d.id === cohort.department_id); return <option key={cohort.id} value={cohort.id}>{cohort.name}{dept ? ` · ${dept.code}` : ''}</option>; })}</select></div>
            <div><label className="mipc-label" htmlFor="new-year">Year of study</label><select className="mipc-field" id="new-year" name="year_of_study" defaultValue=""><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div>
            <div className="flex items-end"><button type="submit" className="mipc-button-primary w-full !bg-mipc-green-700"><PlusIcon className="h-4 w-4" /> Create student account</button></div>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-2xl font-bold text-mipc-navy-950">Registered students</h2><p className="mt-1 text-sm text-ink-600">Update academic placement or portal identity directly from the registry.</p></div>
          <Link href="/admin/audit" className="mipc-button-secondary"><ShieldCheckIcon className="h-4 w-4" /> View audit trail</Link>
        </div>

        <div className="grid gap-4">
          {rows.map((student) => {
            const department: any = departmentRows.find((item) => item.id === student.department_id);
            const cohort: any = cohortRows.find((item) => item.id === student.cohort_id);
            return (
              <details
                key={student.id}
                id={`student-${student.id}`}
                open={highlightedStudentId === student.id}
                className="group overflow-hidden rounded-2xl border border-mipc-navy-900/10 bg-white shadow-sm"
              >
                <summary className="cursor-pointer list-none p-5 marker:content-none sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold text-mipc-navy-950">{student.full_name}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${student.account_status === 'active' ? 'bg-mipc-green-50 text-mipc-green-800' : 'bg-signal-danger-bg text-signal-danger'}`}>{student.account_status}</span></div>
                      <p className="mt-1 font-mono text-xs font-bold text-mipc-green-700">{student.registration_number || 'Registration number not assigned'}</p>
                      <p className="mt-2 text-sm text-ink-600">{department?.name ?? 'Department not assigned'}{cohort ? ` · ${cohort.name}` : ''}{student.year_of_study ? ` · Year ${student.year_of_study}` : ''}</p>
                    </div>
                    <div className="text-left sm:text-right"><p className="text-sm font-semibold text-ink-800">{student.email}</p><p className="mt-1 text-xs text-ink-500">Open to edit record</p></div>
                  </div>
                </summary>

                <form action={updateStudent} className="grid gap-5 border-t border-mipc-navy-900/10 bg-[#f8faf8] p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                  <input type="hidden" name="student_id" value={student.id} />
                  <div className="lg:col-span-2"><label className="mipc-label" htmlFor={`name-${student.id}`}>Full legal name</label><input className="mipc-field" id={`name-${student.id}`} name="full_name" defaultValue={student.full_name} required /></div>
                  <div><label className="mipc-label" htmlFor={`reg-${student.id}`}>Registration number</label><input className="mipc-field uppercase" id={`reg-${student.id}`} name="registration_number" defaultValue={student.registration_number ?? ''} required /></div>
                  <div><label className="mipc-label" htmlFor={`email-${student.id}`}>Login email</label><input className="mipc-field" id={`email-${student.id}`} name="email" type="email" defaultValue={student.email} required /></div>
                  <div><label className="mipc-label" htmlFor={`dept-${student.id}`}>Department</label><select className="mipc-field" id={`dept-${student.id}`} name="department_id" defaultValue={student.department_id ?? ''}><option value="">Not assigned</option>{departmentRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                  <div><label className="mipc-label" htmlFor={`cohort-${student.id}`}>Cohort / intake</label><select className="mipc-field" id={`cohort-${student.id}`} name="cohort_id" defaultValue={student.cohort_id ?? ''}><option value="">Not assigned</option>{cohortRows.map((item) => { const dept: any = departmentRows.find((d) => d.id === item.department_id); return <option key={item.id} value={item.id}>{item.name}{dept ? ` · ${dept.code}` : ''}</option>; })}</select></div>
                  <div><label className="mipc-label" htmlFor={`year-${student.id}`}>Year of study</label><select className="mipc-field" id={`year-${student.id}`} name="year_of_study" defaultValue={student.year_of_study ? String(student.year_of_study) : ''}><option value="">Not assigned</option>{[1,2,3,4,5,6,7,8].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div>
                  <div><label className="mipc-label" htmlFor={`status-${student.id}`}>Portal status</label><select className="mipc-field" id={`status-${student.id}`} name="account_status" defaultValue={student.account_status}><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><button type="submit" className="mipc-button-primary !bg-mipc-green-700"><ShieldCheckIcon className="h-4 w-4" /> Save student record</button></div>
                </form>
              </details>
            );
          })}

          {rows.length === 0 && <div className="rounded-2xl border border-dashed border-mipc-navy-900/15 bg-white p-10 text-center text-sm text-ink-600">No student accounts have been registered yet.</div>}
        </div>
      </section>
    </div>
  );
}
