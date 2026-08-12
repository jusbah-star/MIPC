import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  AwardIcon,
  BookOpenIcon,
  ChevronRightIcon,
  FileTextIcon,
  ShieldCheckIcon,
  UsersIcon
} from '@/components/icons';

export default async function AdminDashboard() {
  const currentAdmin = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'admin');
  let displayName = currentAdmin?.full_name ?? 'MIPC registrar';

  let pendingAppsCount = dataStore.applications.filter((application) => application.status === 'pending').length;
  let studentsCount = dataStore.profiles.filter((profile) => profile.role === 'student').length;
  let facultyCount = dataStore.profiles.filter((profile) => profile.role === 'lecturer').length;
  let auditCount = dataStore.audit_logs.length;
  let recentAudit = dataStore.audit_logs.slice(0, 4);
  let pendingApps = dataStore.applications.filter((application) => application.status === 'pending');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Administrator authentication required.');

    const [profileResult, pendingResult, studentResult, facultyResult, auditResult] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'lecturer'),
      supabase.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(4)
    ]);

    const error = profileResult.error ?? pendingResult.error ?? studentResult.error ?? facultyResult.error ?? auditResult.error;
    if (error) throw new Error(error.message);

    displayName = (profileResult.data as any).full_name;
    pendingAppsCount = pendingResult.count ?? 0;
    studentsCount = studentResult.count ?? 0;
    facultyCount = facultyResult.count ?? 0;
    auditCount = auditResult.count ?? 0;
    recentAudit = (auditResult.data ?? []) as any;

    const { data: applicationRows, error: applicationError } = await supabase
      .from('applications')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at')
      .limit(5);
    if (applicationError) throw new Error(applicationError.message);
    pendingApps = (applicationRows ?? []) as any;
  }

  const stats = [
    { label: 'Pending applications', value: pendingAppsCount, detail: 'Awaiting review', icon: AwardIcon },
    { label: 'Students', value: studentsCount, detail: 'Registered accounts', icon: UsersIcon },
    { label: 'Lecturers', value: facultyCount, detail: 'Registered faculty', icon: BookOpenIcon },
    { label: 'Audit events', value: auditCount, detail: 'Recorded security actions', icon: ShieldCheckIcon }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-ink-900/[0.07] bg-white p-6 shadow-academic sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mipc-eyebrow">Administration overview</p>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink-950 sm:text-4xl">Welcome, {displayName}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-600">Admissions, people, curriculum and institutional oversight—organized for faster daily decisions.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/admin/audit" className="mipc-button-secondary"><FileTextIcon className="h-4 w-4" /> Audit trail</Link>
          <Link href="/admin/applications" className="mipc-button-primary">
            Admissions {pendingAppsCount ? `(${pendingAppsCount})` : ''} <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="mipc-stat min-h-[148px]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold text-ink-500">{label}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-6 font-display text-3xl font-extrabold tracking-[-0.035em] text-ink-950">{value}</p>
            <p className="mt-1 text-xs text-ink-500">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-mipc-green-700">Admissions</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Applications awaiting action</h2>
            </div>
            <Link href="/admin/applications" className="text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-900">Open pipeline</Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            {pendingApps.slice(0, 5).map((application) => (
              <Link key={application.id} href="/admin/applications" className="group flex flex-col gap-4 border-b border-ink-900/[0.06] p-4 last:border-b-0 hover:bg-parchment-50 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">#{application.id.slice(-6).toUpperCase()}</span>
                    <span className="text-xs text-ink-400">{new Date(application.submitted_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-ink-950">{application.full_name}</p>
                  <p className="mt-1 truncate text-xs text-ink-500">{application.email}{application.phone ? ` · ${application.phone}` : ''}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-mipc-green-700">Review <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
            {pendingApps.length === 0 ? <div className="mipc-empty m-4">The admissions review queue is clear.</div> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-mipc-green-700">Security</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Recent activity</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            {recentAudit.map((log) => (
              <div key={log.id} className="border-b border-ink-900/[0.06] p-4 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-parchment-100 px-2.5 py-1 text-[10px] font-semibold text-ink-600">{log.action}</span>
                  <span className="text-[11px] text-ink-400">{new Date(log.created_at).toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900">{log.target_table}</p>
                <p className="mt-1 truncate text-xs text-ink-500">Record {log.target_id.slice(-8)}</p>
              </div>
            ))}
            {!recentAudit.length ? <div className="p-6 text-center text-sm text-ink-500">No audit activity to display.</div> : null}
          </div>
          <Link href="/admin/audit" className="mipc-button-secondary w-full">View complete audit log</Link>
        </div>
      </section>
    </div>
  );
}
