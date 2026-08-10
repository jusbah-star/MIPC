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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mipc-eyebrow">Registrar access control</p><h1 className="mipc-page-title">User accounts and roles</h1><p className="mt-2 max-w-2xl text-sm text-ink-700">Assign the minimum required role or suspend access. Every change is atomic and written to the security audit trail.</p></div><div className="mipc-status flex items-center gap-2"><UsersIcon className="h-4 w-4" /> {activeCount} active accounts</div></header>

      <section className="mipc-panel overflow-hidden" aria-labelledby="user-register-title">
        <div className="border-b border-parchment-200 p-5"><h2 id="user-register-title" className="font-display text-xl font-bold text-ink-950">Authoritative user register</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600"><tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Current access</th><th className="px-5 py-3">Registrar action</th></tr></thead>
            <tbody className="divide-y divide-parchment-200">{profiles.map((profile) => {
              const department = departments.find((item) => item.id === profile.department_id);
              const isSelf = profile.id === currentUserId;
              return <tr key={profile.id}><td className="px-5 py-4"><p className="font-semibold text-ink-950">{profile.full_name}</p><p className="text-xs text-ink-600">{profile.email}</p><p className="mt-1 font-mono text-[10px] text-ink-400">{profile.id}</p></td><td className="px-5 py-4 text-ink-700">{department?.name ?? 'Not assigned'}</td><td className="px-5 py-4"><span className="mipc-status">{profile.role}</span><p className={`mt-2 text-xs font-bold ${profile.account_status === 'suspended' ? 'text-signal-danger' : 'text-signal-ok'}`}>{profile.account_status ?? 'active'}</p></td><td className="px-5 py-4"><form action={updateUserAccess} className="flex items-end gap-2"><input type="hidden" name="user_id" value={profile.id} /><div><label className="mipc-label" htmlFor={`role-${profile.id}`}>Role</label><select className="mipc-input min-w-32" id={`role-${profile.id}`} name="role" defaultValue={profile.role} disabled={isSelf}><option value="student">Student</option><option value="lecturer">Lecturer</option><option value="admin">Admin</option></select></div><div><label className="mipc-label" htmlFor={`status-${profile.id}`}>Status</label><select className="mipc-input min-w-32" id={`status-${profile.id}`} name="account_status" defaultValue={profile.account_status ?? 'active'} disabled={isSelf}><option value="active">Active</option><option value="suspended">Suspended</option></select></div><button type="submit" className="mipc-button-secondary" disabled={isSelf}><ShieldCheckIcon className="h-4 w-4" /> Save</button>{isSelf && <input type="hidden" name="account_status" value="active" />}{isSelf && <input type="hidden" name="role" value="admin" />}</form></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
