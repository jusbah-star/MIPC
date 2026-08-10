import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { approveApplication, rejectApplication } from './actions';
import {
  AwardIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon
} from '@/components/icons';

export default async function ApplicationsPage() {
  let applications = dataStore.applications;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: dbApps, error } = await supabase
      .from('applications')
      .select('id, full_name, email, phone, statement, status, submitted_at')
      .order('submitted_at', { ascending: false });
    if (error) throw new Error('Applications could not be loaded.');
    applications = (dbApps ?? []) as any;
  }

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-brass-600 font-bold block mb-1">
            Admissions Board Governance
          </span>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Candidate Matriculation Pipeline
          </h1>
          <p className="mt-1 text-sm text-ink-700">
            Adjudicate candidate dossiers. Approval generates verified student credentials, assigns a matriculation number, and seeds foundational course enrollments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-brass-400/20 text-brass-700 px-3 py-1.5 rounded-lg font-bold">
            {pendingCount} Pending Review
          </span>
          <span className="text-xs font-mono bg-signal-ok-bg text-signal-ok px-3 py-1.5 rounded-lg font-bold">
            {approvedCount} Matriculated
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {applications.map((app) => {
          const isPending = app.status === 'pending' || app.status === 'under_review';
          const isApproved = app.status === 'approved';
          const isRejected = app.status === 'rejected';

          return (
            <div
              key={app.id}
              className="bg-white rounded-2xl border border-ink-900/10 p-6 sm:p-8 shadow-academic space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-parchment-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-parchment-200 text-ink-900 flex items-center justify-center font-display font-bold text-lg">
                    {app.full_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink-950">
                      {app.full_name}
                    </h2>
                    <p className="text-xs font-mono text-ink-500">
                      {app.email} {app.phone ? `· ${app.phone}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-500">
                    Lodged: {new Date(app.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>

                  {isPending && (
                    <span className="text-[10px] font-mono text-signal-warn bg-signal-warn-bg px-2.5 py-1 rounded font-bold uppercase">
                      Pending Adjudication
                    </span>
                  )}
                  {isApproved && (
                    <span className="text-[10px] font-mono text-signal-ok bg-signal-ok-bg px-2.5 py-1 rounded font-bold uppercase flex items-center gap-1">
                      <CheckCircleIcon className="w-3 h-3" />
                      <span>Matriculated</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="text-[10px] font-mono text-signal-danger bg-signal-danger-bg px-2.5 py-1 rounded font-bold uppercase">
                      Declined
                    </span>
                  )}
                </div>
              </div>

              {/* Personal Statement */}
              {(app as any).statement && (
                <div className="space-y-1.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink-600 font-bold block">
                    Candidate Statement of Purpose
                  </span>
                  <div className="bg-parchment-50 rounded-xl border border-parchment-300 p-4 text-xs text-ink-900 font-serif leading-relaxed italic">
                    &ldquo;{(app as any).statement}&rdquo;
                  </div>
                </div>
              )}

              {/* Decision Actions */}
              {isPending && (
                <div className="pt-3 flex items-center justify-end gap-3">
                  <form action={rejectApplication.bind(null, app.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-signal-danger-bg text-signal-danger hover:bg-signal-danger/20 border border-signal-danger/30 px-4 py-2 text-xs font-mono font-bold transition-colors"
                    >
                      Decline Admission
                    </button>
                  </form>

                  <form action={approveApplication.bind(null, app.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-ink-900 text-white hover:bg-ink-800 px-5 py-2 text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5 text-brass-400" />
                      <span>Approve & Matriculate Student</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}

        {applications.length === 0 && (
          <div className="bg-white rounded-2xl border border-ink-900/10 p-12 text-center text-ink-500 font-mono text-xs">
            No applications recorded in the admissions ledger.
          </div>
        )}
      </div>
    </div>
  );
}
