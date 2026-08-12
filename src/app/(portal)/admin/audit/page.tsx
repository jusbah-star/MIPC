import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { ShieldCheckIcon } from '@/components/icons';

export default async function AdminAuditPage() {
  let auditLogs = dataStore.audit_logs;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: dbLogs, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
    if (error) throw new Error('The audit register could not be loaded.');
    auditLogs = (dbLogs ?? []) as any;
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Audit & security</p>
          <h1 className="mipc-page-title">Security activity</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">A chronological record of sensitive administrative and academic actions captured by the platform.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-signal-ok-bg px-3 py-1.5 text-xs font-semibold text-signal-ok"><ShieldCheckIcon className="h-4 w-4" /> {auditLogs.length} recorded events</span>
      </header>

      <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
        <div className="border-b border-ink-900/[0.07] p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-[-0.02em]">Audit trail</h2>
          <p className="mt-1 text-xs text-ink-500">Newest events appear first. Payload details are shown exactly as recorded.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="mipc-table min-w-[960px]">
            <thead><tr><th>Time</th><th>Action</th><th>Resource</th><th>Actor</th><th>Recorded change</th></tr></thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-RW')}</td>
                  <td><span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{log.action}</span></td>
                  <td><p className="font-medium text-ink-900">{log.target_table}</p><p className="mt-1 text-xs text-ink-400">{log.target_id ? log.target_id.slice(0, 12) : '—'}</p></td>
                  <td><span className="text-xs text-ink-500">{log.actor_id ? log.actor_id.slice(0, 16) : 'System'}</span></td>
                  <td><pre className="max-w-sm overflow-x-auto rounded-xl bg-parchment-100 p-3 text-[11px] leading-5 text-ink-700">{JSON.stringify(log.new_value ?? {}, null, 1)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditLogs.length === 0 ? <div className="mipc-empty m-4">No security events have been recorded.</div> : null}
      </section>
    </div>
  );
}
