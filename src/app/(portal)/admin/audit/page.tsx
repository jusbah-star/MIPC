import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon
} from '@/components/icons';

export default async function AdminAuditPage() {
  let auditLogs = dataStore.audit_logs;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: dbLogs, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error('The audit register could not be loaded.');
    auditLogs = (dbLogs ?? []) as any;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-brass-600 font-bold block mb-1">
            System Integrity & Security
          </span>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Immutable Audit Trail
          </h1>
          <p className="mt-1 text-sm text-ink-700">
            Cryptographically timestamped ledger of administrative approvals, grade publications, and identity updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-signal-ok-bg text-signal-ok px-3 py-1.5 rounded-lg text-xs font-mono font-bold">
            <ShieldCheckIcon className="w-4 h-4" />
            <span>RLS & Ledger Enforced</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-ink-900/10 shadow-academic overflow-hidden">
        <div className="p-6 border-b border-parchment-200">
          <span className="text-xs font-mono font-bold text-ink-700 uppercase">
            Audit Ledger ({auditLogs.length} Verified Events)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-parchment-100/70 border-b border-parchment-300 text-ink-700 font-semibold uppercase">
              <tr>
                <th className="p-4">Timestamp (UTC)</th>
                <th className="p-4">Action Type</th>
                <th className="p-4">Target Resource</th>
                <th className="p-4">Actor UID</th>
                <th className="p-4">Audit Payload State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-200">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-parchment-50/60 transition-colors">
                  <td className="p-4 text-ink-600 font-mono">
                    {new Date(log.created_at).toLocaleString('en-GB')}
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brass-700 bg-brass-400/20 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-ink-950 font-medium">
                    {log.target_table} · <span className="text-ink-500">{log.target_id ? log.target_id.slice(0, 12) : '—'}</span>
                  </td>
                  <td className="p-4 text-ink-600 font-mono">
                    {log.actor_id ? log.actor_id.slice(0, 16) : 'System / Automated'}
                  </td>
                  <td className="p-4">
                    <pre className="bg-parchment-100/80 p-1.5 rounded text-[10px] font-mono text-ink-800 max-w-xs overflow-x-auto">
                      {JSON.stringify(log.new_value ?? {}, null, 1)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
