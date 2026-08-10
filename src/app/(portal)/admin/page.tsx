import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  ShieldCheckIcon,
  AwardIcon,
  UsersIcon,
  BookOpenIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon
} from '@/components/icons';

export default async function AdminDashboard() {
  const currentAdmin = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'admin');
  let displayName = currentAdmin?.full_name ?? 'MIPC registrar';

  let pendingAppsCount = dataStore.applications.filter((a) => a.status === 'pending').length;
  let studentsCount = dataStore.profiles.filter((p) => p.role === 'student').length;
  let facultyCount = dataStore.profiles.filter((p) => p.role === 'lecturer').length;
  let auditCount = dataStore.audit_logs.length;
  let recentAudit = dataStore.audit_logs.slice(0, 4);
  let pendingApps = dataStore.applications.filter((a) => a.status === 'pending');

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
    const { data: applicationRows, error: applicationError } = await supabase.from('applications').select('*').eq('status', 'pending').order('submitted_at').limit(5);
    if (applicationError) throw new Error(applicationError.message);
    pendingApps = (applicationRows ?? []) as any;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-ink-950 to-ink-900 text-white rounded-2xl p-6 sm:p-8 shadow-academic border border-ink-800">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-brass-400 font-semibold block mb-1">
            Office of the Academic Registrar
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Administrative workspace · {displayName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-500 font-mono">
            Direct institutional admissions, govern user credentials, and audit security events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/applications"
            className="rounded-lg bg-brass-500 px-4 py-2 text-xs sm:text-sm font-semibold text-ink-950 hover:bg-brass-400 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <AwardIcon className="w-4 h-4" />
            <span>Admissions Queue ({pendingAppsCount})</span>
          </Link>
          <Link
            href="/admin/audit"
            className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition-colors flex items-center gap-1.5"
          >
            <FileTextIcon className="w-4 h-4 text-brass-400" />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Pending Dossiers</span>
            <AwardIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-brass-700">{pendingAppsCount}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Awaiting Dean review</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Matriculated Students</span>
            <UsersIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{studentsCount}</div>
          <p className="text-[11px] text-signal-ok mt-1 font-mono font-medium">Registered student accounts</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Senior Faculty</span>
            <BookOpenIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{facultyCount}</div>
          <p className="text-[11px] text-ink-600 mt-1 font-mono">Registered lecturer accounts</p>
        </div>

        <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Audit Logs</span>
            <ShieldCheckIcon className="w-4 h-4 text-brass-600" />
          </div>
          <div className="font-display text-2xl font-bold text-ink-950">{auditCount}</div>
          <p className="text-[11px] text-signal-ok mt-1 font-mono font-medium">Security Verified</p>
        </div>
      </div>

      {/* Main Grid: Pending Applications & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pending Applications (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-950">
              Candidate Applications Awaiting Action
            </h2>
            <Link
              href="/admin/applications"
              className="text-xs font-mono text-brass-600 hover:text-brass-700 flex items-center gap-1"
            >
              <span>Full Admissions Pipeline</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {pendingApps.map((app) => (
              <div
                key={app.id}
                className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-brass-700 bg-brass-400/15 px-2 py-0.5 rounded">
                      Dossier #{app.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-xs font-mono text-ink-500">
                      Applied {new Date(app.submitted_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-950">
                    {app.full_name}
                  </h3>
                  <p className="text-xs font-mono text-ink-600">
                    {app.email} {app.phone ? `· ${app.phone}` : ''}
                  </p>
                </div>

                <Link
                  href="/admin/applications"
                  className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 transition-colors self-start sm:self-auto flex items-center gap-1 shrink-0"
                >
                  <span>Review Dossier</span>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-brass-400" />
                </Link>
              </div>
            ))}

            {pendingApps.length === 0 && (
              <div className="bg-white rounded-xl border border-ink-900/10 p-8 text-center text-xs font-mono text-ink-500">
                Admissions queue is clear. No pending applications.
              </div>
            )}
          </div>
        </div>

        {/* Security & Audit Snapshot (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-950">
              Live Security Trail
            </h2>
            <Link
              href="/admin/audit"
              className="text-xs font-mono text-brass-600 hover:text-brass-700"
            >
              Full Log
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs space-y-3">
            {recentAudit.map((log) => (
              <div key={log.id} className="pb-3 border-b border-parchment-200 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-brass-700 bg-brass-400/15 px-1.5 py-0.2 rounded">
                    {log.action}
                  </span>
                  <span className="text-[10px] font-mono text-ink-500">
                    {new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink-900">
                  Target: {log.target_table} ({log.target_id.slice(-6)})
                </p>
                <p className="text-[10px] font-mono text-ink-500">
                  Actor: {log.actor_id}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
