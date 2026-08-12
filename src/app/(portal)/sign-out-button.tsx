'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await createClient().auth.signOut();
        } catch {
          // Ignore sign-out transport errors and still clear local demo state.
        }
        document.cookie = 'mipc_demo_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'ashcombe_demo_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/login');
        router.refresh();
      }}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
        variant === 'dark'
          ? 'text-white/55 hover:bg-white/[0.07] hover:text-white'
          : 'text-ink-600 hover:bg-parchment-100 hover:text-signal-danger'
      }`}
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
      </svg>
      <span>Sign out</span>
    </button>
  );
}
