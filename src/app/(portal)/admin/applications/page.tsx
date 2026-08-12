import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { approveApplication, rejectApplication } from './actions';
import { CheckCircleIcon, ChevronRightIcon, FileTextIcon } from '@/components/icons';

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

  const pendingCount = applications.filter((application) => application.status === 'pending' || application.status === 'under_review').length;
  const approvedCount = applications.filter((application) => application.status === 'approved').length;
  const rejectedCount = applications.filter((application) => application.status === 'rejected').length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Admissions</p>
          <h1 className="mipc-page-title">Application review</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
            Review candidate details and statements, then record the official admission decision. Approved applications continue into student onboarding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-signal-warn-bg px-3 py-1.5 text-xs font-semibold text-signal-warn">{pendingCount} pending</span>
          <span className="rounded-full bg-signal-ok-bg px-3 py-1.5 text-xs font-semibold text-signal-ok">{approvedCount} approved</span>
          <span className="rounded-full bg-parchment-200 px-3 py-1.5 text-xs font-semibold text-ink-600">{rejectedCount} declined</span>
        </div>
      </header>

      <div className="grid gap-4">
        {applications.map((application) => {
          const isPending = application.status === 'pending' || application.status === 'under_review';
          const isApproved = application.status === 'approved';
          const isRejected = application.status === 'rejected';

          return (
            <article key={application.id} className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
              <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mipc-green-50 text-sm font-bold text-mipc-green-800">
                    {application.full_name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join('')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold tracking-[-0.02em] text-ink-950">{application.full_name}</h2>
                      {isPending ? <span className="rounded-full bg-signal-warn-bg px-2.5 py-1 text-[11px] font-semibold text-signal-warn">Pending review</span> : null}
                      {isApproved ? <span className="inline-flex items-center gap-1 rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok"><CheckCircleIcon className="h-3 w-3" /> Approved</span> : null}
                      {isRejected ? <span className="rounded-full bg-signal-danger-bg px-2.5 py-1 text-[11px] font-semibold text-signal-danger">Declined</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-ink-500">{application.email}{application.phone ? ` · ${application.phone}` : ''}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span>Reference #{application.id.slice(-6).toUpperCase()}</span>
                      <span>Submitted {new Date(application.submitted_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {isPending ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <form action={rejectApplication.bind(null, application.id)}>
                      <button type="submit" className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-signal-danger/15 bg-white px-4 py-2 text-sm font-semibold text-signal-danger transition hover:bg-signal-danger-bg sm:w-auto">
                        Decline
                      </button>
                    </form>
                    <form action={approveApplication.bind(null, application.id)}>
                      <button type="submit" className="mipc-button-primary min-h-10 px-4 py-2">
                        <CheckCircleIcon className="h-4 w-4" /> Approve application
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

              {(application as any).statement ? (
                <div className="border-t border-ink-900/[0.06] bg-parchment-50 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                    <FileTextIcon className="h-4 w-4 text-mipc-green-700" /> Statement of purpose
                  </div>
                  <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-ink-700">{(application as any).statement}</p>
                </div>
              ) : (
                <div className="border-t border-ink-900/[0.06] bg-parchment-50 px-5 py-4 text-xs text-ink-400 sm:px-6">No statement of purpose was provided.</div>
              )}
            </article>
          );
        })}

        {applications.length === 0 ? (
          <div className="mipc-empty">
            <FileTextIcon className="mx-auto mb-3 h-6 w-6 text-ink-400" />
            No applications have been recorded yet.
          </div>
        ) : null}
      </div>

      {applications.length ? (
        <div className="flex items-center justify-end gap-1 text-xs text-ink-400">
          Showing {applications.length} application{applications.length === 1 ? '' : 's'} <ChevronRightIcon className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </div>
  );
}
