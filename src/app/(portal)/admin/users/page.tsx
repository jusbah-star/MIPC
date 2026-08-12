import { redirect } from 'next/navigation';
import { ShieldCheckIcon, UsersIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { updateUserAccess } from './actions';

export default async function AdminUsersPage() {
  let profiles: any[] = dataStore.profiles;
  let departments: any[] = dataStore.departments;
  let currentUserId = 'user-admin-1';

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    currentUserId = user.id;

    const [profileResult, departmentResult] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('departments').select('*').order('name')
    ]);
    if (profileResult.error || departmentResult.error) throw new Error(profileResult.error?.message ?? departmentResult.error?.message);
    profiles = (profileResult.data ?? []) as any;
    departments = (departmentResult.data ?? []) as any;
  }

  const activeCount = profiles.filter((item) => item.account_status !== 'suspended').length;
  const suspendedCount = profiles.length - activeCount;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">People & access</p>
          <h1 className="mipc-page-title">User accounts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Review institutional accounts, assign the minimum appropriate role, and suspend access when required.</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-ok-bg px-3 py-1.5 text-xs font-semibold text-signal-ok"><UsersIcon className="h-3.5 w-3.5" /> {activeCount} active</span>
          {suspendedCount ? <span className="rounded-full bg-signal-danger-bg px-3 py-1.5 text-xs font-semibold text-signal-danger">{suspendedCount} suspended</span> : null}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs" aria-labelledby="user-register-title">
        <div className="flex items-center justify-between gap-4 border-b border-ink-900/[0.07] p-5 sm:p-6">
          <div>
            <h2 id="user-register-title" className="text-lg font-bold tracking-[-0.02em]">Institutional directory</h2>
            <p className="mt-1 text-xs text-ink-500">Role and status changes are recorded in the audit trail.</p>
          </div>
          <ShieldCheckIcon className="h-5 w-5 text-mipc-green-700" />
        </div>

        <div className="overflow-x-auto">
          <table className="mipc-table min-w-[960px]">
            <thead>
              <tr><th>Member</th><th>Department</th><th>Access</th><th>Change access</th></tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const department = departments.find((item) => item.id === profile.department_id);
                const isSelf = profile.id === currentUserId;

                return (
                  <tr key={profile.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-parchment-100 text-xs font-bold text-ink-700">
                          {profile.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('')}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-950">{profile.full_name}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-500">{profile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{department?.name ?? 'Not assigned'}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-mipc-green-700">{profile.role}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${profile.account_status === 'suspended' ? 'bg-signal-danger-bg text-signal-danger' : 'bg-signal-ok-bg text-signal-ok'}`}>{profile.account_status ?? 'active'}</span>
                      </div>
                    </td>
                    <td>
                      <form action={updateUserAccess} className="flex items-end gap-2">
                        <input type="hidden" name="user_id" value={profile.id} />
                        <div>
                          <label className="mipc-label text-xs" htmlFor={`role-${profile.id}`}>Role</label>
                          <select className="mipc-input min-w-32 py-2" id={`role-${profile.id}`} name="role" defaultValue={profile.role} disabled={isSelf}>
                            <option value="student">Student</option><option value="lecturer">Lecturer</option><option value="admin">Admin</option>
                          </select>
                        </div>
                        <div>
                          <label className="mipc-label text-xs" htmlFor={`status-${profile.id}`}>Status</label>
                          <select className="mipc-input min-w-32 py-2" id={`status-${profile.id}`} name="account_status" defaultValue={profile.account_status ?? 'active'} disabled={isSelf}>
                            <option value="active">Active</option><option value="suspended">Suspended</option>
                          </select>
                        </div>
                        <button type="submit" className="mipc-button-secondary min-h-11 px-3" disabled={isSelf}>Save</button>
                        {isSelf ? <><input type="hidden" name="account_status" value="active" /><input type="hidden" name="role" value="admin" /></> : null}
                      </form>
                      {isSelf ? <p className="mt-2 text-[11px] text-ink-400">Your own administrator access is protected here.</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
