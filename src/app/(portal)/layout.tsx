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
    // In standalone / demo mode, read active role from cookies or active dataStore user
    const cookieStore = await cookies();
    const demoCookieRole = (cookieStore.get('mipc_demo_role')?.value || cookieStore.get('ashcombe_demo_role')?.value) as UserRole | undefined;
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
    <div className="min-h-screen bg-parchment-50 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Institutional Sidebar */}
      <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-ink-900/10 bg-white/95 p-4 shadow-academic lg:flex lg:flex-col lg:justify-between">
        <PortalNav role={role} fullName={fullName} email={email} isDemo={!isSupabaseConfigured} />
        <div className="mt-4 pt-3 border-t border-ink-900/10">
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Academic Ribbon */}
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-ink-900/10 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tracking-wider uppercase text-mipc-green-800 font-bold bg-mipc-green-100 border border-mipc-green-300/80 px-2 py-0.5 rounded">
              Academic Year 2026/2027
            </span>
            <span className="text-xs text-ink-600 hidden sm:inline font-medium">
              Muhabura Integrated Polytechnic College (MIPC) · Musanze Campus
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal-ok animate-pulse" />
              <span className="text-xs font-mono text-ink-700 font-medium">MIPC Online</span>
            </div>
          </div>
        </header>

        <details className="border-b border-ink-900/10 bg-white lg:hidden">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-bold text-mipc-green-900 marker:content-none">
            <span className="flex items-center justify-between">Portal menu <span aria-hidden="true">＋</span></span>
          </summary>
          <div className="max-h-[70vh] overflow-y-auto border-t border-parchment-200 p-4">
            <PortalNav role={role} fullName={fullName} email={email} isDemo={!isSupabaseConfigured} />
            <div className="mt-4 border-t border-parchment-200 pt-4"><SignOutButton /></div>
          </div>
        </details>

        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
