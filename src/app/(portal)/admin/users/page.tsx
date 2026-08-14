import { redirect } from 'next/navigation';
import { PlusIcon, ShieldCheckIcon, UsersIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createStaffMember, updateUserAccess } from './actions';

const roleGroups = [
  { role: 'admin', title: 'Principal / Administration', description: 'Institution-wide oversight and privileged administration.' },
  { role: 'hod', title: 'Heads of Department', description: 'Department leadership, lecturer governance and teaching allocation.' },
  { role: 'registrar', title: 'Registrar', description: 'Admissions, registration records and student matriculation.' },
  { role: 'finance', title: 'Finance', description: 'Student payment status, finance processing and clearance.' },
  { role: 'lecturer', title: 'Lecturers', description: 'Academic staff assigned to departments, classes and courses.' },
  { role: 'student', title: 'Students', description: 'Registered learners with active student portal identities.' }
] as const;

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
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('departments').select('*').order('name')
    ]);
    if (profileResult.error || departmentResult.error) {
      throw new Error(profileResult.error?.message ?? departmentResult.error?.message);
    }
    profiles = (profileResult.data ?? []) as any[];
    departments = (departmentResult.data ?? []) as any[];
  }

  const activeCount = profiles.filter((item) => item.account_status !== 'suspended').length;
  const staffCount = profiles.filter((item) => ['lecturer', 'hod', 'registrar', 'finance', 'admin'].includes(item.role)).length;

  const roleCounts = roleGroups.map((group) => {
    const members = profiles.filter((profile) => profile.role === group.role);
    return {
      ...group,
      members,
      active: members.filter((profile) => profile.account_status !== 'suspended').length,
      suspended: members.filter((profile) => profile.account_status === 'suspended').length
    };
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mipc-eyebrow">Principal · identity and access governance</p>
          <h1 className="mipc-page-title">Staff and user directory</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-700">
            User accounts are organized by institutional responsibility so the Principal can review staff and students without mixing unrelated roles in one register.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="mipc-status"><UsersIcon className="mr-2 h-4 w-4" />{activeCount} active</span>
          <span className="mipc-status">{staffCount} staff</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roleCounts.map((group) => (
          <a
            key={group.role}
            href={`#role-${group.role}`}
            className="rounded-2xl border border-mipc-navy-900/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-mipc-green-700/30 hover:shadow-academic"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-ink-950">{group.title}</p>
                <p className="mt-1 text-xs leading-5 text-ink-600">{group.description}</p>
              </div>
              <span className="grid h-9 min-w-9 place-items-center rounded-full bg-mipc-green-50 px-2 text-sm font-bold text-mipc-green-800">
                {group.members.length}
              </span>
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <span className="font-semibold text-signal-ok">{group.active} active</span>
              {group.suspended > 0 && <span className="font-semibold text-signal-danger">{group.suspended} suspended</span>}
            </div>
          </a>
        ))}
      </section>

      {isSupabaseConfigured() && (
        <section className="overflow-hidden rounded-[1.5rem] border border-mipc-navy-900/10 bg-white shadow-academic">
          <div className="grid lg:grid-cols-[.75fr_1.25fr]">
            <div className="bg-mipc-navy-950 p-6 text-white sm:p-8">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-mipc-green-700"><PlusIcon className="h-5 w-5" /></span>
              <h2 className="mt-5 font-display text-2xl font-bold">Create staff account</h2>
              <p className="mt-3 text-sm leading-6 text-white/70">The Principal provisions the sign-in identity and institutional role. HOD and Lecturer accounts must be attached to a department.</p>
              <div className="mt-6 space-y-2 text-sm text-white/65">
                <p>• HOD governs one department.</p>
                <p>• Registrar owns student registration.</p>
                <p>• Finance owns payment and clearance.</p>
                <p>• Lecturer receives courses from the HOD.</p>
              </div>
            </div>
            <form action={createStaffMember} className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <div className="sm:col-span-2"><label className="mipc-label">Full legal name</label><input className="mipc-field" name="full_name" required maxLength={160} /></div>
              <div><label className="mipc-label">Staff email</label><input className="mipc-field" type="email" name="email" required maxLength={320} /></div>
              <div><label className="mipc-label">Governance role</label><select className="mipc-field" name="role" defaultValue="lecturer"><option value="lecturer">Lecturer</option><option value="hod">Head of Department (HOD)</option><option value="registrar">Registrar</option><option value="finance">Finance</option></select></div>
              <div className="sm:col-span-2"><label className="mipc-label">Department <span className="font-normal text-ink-500">(required for Lecturer/HOD; leave empty for Registrar/Finance)</span></label><select className="mipc-field" name="department_id" defaultValue=""><option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
              <div className="sm:col-span-2"><button type="submit" className="mipc-button-primary w-full !bg-mipc-green-700"><PlusIcon className="h-4 w-4" /> Create staff portal account</button></div>
            </form>
          </div>
        </section>
      )}

      <div className="space-y-6">
        {roleCounts.map((group) => (
          <section key={group.role} id={`role-${group.role}`} className="mipc-panel scroll-mt-28 overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-parchment-200 p-5">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-950">{group.title}</h2>
                <p className="mt-1 text-sm text-ink-600">{group.description}</p>
              </div>
              <div className="flex gap-2">
                <span className="mipc-status">{group.members.length} total</span>
                <span className="mipc-status">{group.active} active</span>
              </div>
            </div>

            {group.members.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-600">No {group.title.toLowerCase()} accounts have been created yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-parchment-50 text-xs uppercase tracking-wider text-ink-600">
                    <tr>
                      <th className="px-5 py-3">Member</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3">Access status</th>
                      <th className="px-5 py-3">Principal action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment-200">
                    {group.members.map((profile) => {
                      const department = departments.find((item) => item.id === profile.department_id);
                      const isSelf = profile.id === currentUserId;
                      return (
                        <tr key={profile.id}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-ink-950">{profile.full_name}</p>
                            <p className="text-xs text-ink-600">{profile.email}</p>
                            {profile.registration_number && <p className="mt-1 text-[11px] font-semibold text-mipc-green-700">{profile.registration_number}</p>}
                          </td>
                          <td className="px-5 py-4 text-ink-700">{department?.name ?? 'Not assigned'}</td>
                          <td className="px-5 py-4">
                            <span className="mipc-status capitalize">{profile.role === 'admin' ? 'Principal / Admin' : profile.role}</span>
                            <p className={`mt-2 text-xs font-bold ${profile.account_status === 'suspended' ? 'text-signal-danger' : 'text-signal-ok'}`}>{profile.account_status ?? 'active'}</p>
                          </td>
                          <td className="px-5 py-4">
                            <form action={updateUserAccess} className="flex items-end gap-2">
                              <input type="hidden" name="user_id" value={profile.id} />
                              <div>
                                <label className="mipc-label">Role</label>
                                <select className="mipc-field min-w-36" name="role" defaultValue={profile.role} disabled={isSelf}>
                                  <option value="student">Student</option>
                                  <option value="lecturer">Lecturer</option>
                                  <option value="hod">HOD</option>
                                  <option value="registrar">Registrar</option>
                                  <option value="finance">Finance</option>
                                  <option value="admin">Principal / Admin</option>
                                </select>
                              </div>
                              <div>
                                <label className="mipc-label">Status</label>
                                <select className="mipc-field min-w-32" name="account_status" defaultValue={profile.account_status ?? 'active'} disabled={isSelf}>
                                  <option value="active">Active</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                              </div>
                              <button type="submit" className="mipc-button-secondary" disabled={isSelf}><ShieldCheckIcon className="h-4 w-4" /> Save</button>
                              {isSelf && <><input type="hidden" name="account_status" value="active" /><input type="hidden" name="role" value="admin" /></>}
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
