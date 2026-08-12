import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import PortalNav from './portal-nav';
import SignOutButton from './sign-out-button';
import type { UserRole } from '@/lib/database.types';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref')
  );

  let role: UserRole = 'student';
  let fullName = 'Jean-Luc Habimana';
  let email = 'j.habimana@mipc.ac.rw';

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, full_name, email, account_status')
      .eq('id', user.id)
      .single();

    if (error || !profile) throw new Error('Your MIPC profile could not be loaded.');

    const p = profile as any;
    if (p.account_status === 'suspended') redirect('/login?error=account_suspended');

    role = p.role;
    fullName = p.full_name;
    email = p.email;
  } else {
    const cookieStore = await cookies();
    const demoCookieRole = (
      cookieStore.get('mipc_demo_role')?.value || cookieStore.get('ashcombe_demo_role')?.value
    ) as UserRole | undefined;

    if (demoCookieRole && ['student', 'lecturer', 'admin'].includes(demoCookieRole)) {
      role = demoCookieRole;
      const matched = dataStore.profiles.find((p) => p.role === role);
      if (matched) {
        fullName = matched.full_name;
        email = matched.email;
        dataStore.currentUser = matched;
      }
    } else if (dataStore.currentUser) {
      role = dataStore.currentUser.role;
      fullName = dataStore.currentUser.full_name;
      email = dataStore.currentUser.email;
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] lg:grid lg:grid-cols-[276px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-mipc-green-950 p-4 text-white lg:flex lg:flex-col">
        <div className="min-h-0 flex-1">
          <PortalNav role={role} fullName={fullName} email={email} isDemo={!isSupabaseConfigured} />
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <SignOutButton variant="dark" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-900/[0.07] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] w-full max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mipc-green-700">MIPC Digital Campus</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink-900">
                {role === 'student' ? 'Student workspace' : role === 'lecturer' ? 'Faculty workspace' : 'Administration workspace'}
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-ink-900/[0.07] bg-parchment-100 px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 rounded-full bg-signal-ok" />
                <span className="text-xs font-medium text-ink-600">Systems online</span>
              </div>
              <span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-xs font-semibold text-mipc-green-800">
                2026/2027
              </span>
            </div>
          </div>
        </header>

        <details className="group border-b border-ink-900/[0.07] bg-white lg:hidden">
          <summary className="cursor-pointer list-none px-5 py-3.5 marker:content-none">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold text-ink-900">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mipc-green-900 text-xs font-bold text-white">M</span>
                <span className="truncate">Menu · {fullName}</span>
              </span>
              <span aria-hidden="true" className="text-lg font-normal text-ink-500 transition group-open:rotate-45">＋</span>
            </span>
          </summary>
          <div className="max-h-[75vh] overflow-y-auto bg-mipc-green-950 p-4 text-white">
            <PortalNav role={role} fullName={fullName} email={email} isDemo={!isSupabaseConfigured} compact />
            <div className="mt-4 border-t border-white/10 pt-3">
              <SignOutButton variant="dark" />
            </div>
          </div>
        </details>

        <main id="main-content" className="mx-auto w-full max-w-[1500px] flex-1 p-5 sm:p-7 lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
