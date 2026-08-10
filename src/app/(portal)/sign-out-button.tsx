'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        try {
          await createClient().auth.signOut();
        } catch {
          // Ignore
        }
        document.cookie = 'mipc_demo_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'ashcombe_demo_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/login');
        router.refresh();
      }}
      className="flex items-center gap-2 text-xs font-medium text-ink-600 hover:text-signal-danger transition-colors w-full px-2 py-1.5 rounded hover:bg-parchment-100"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
      </svg>
      Sign out of MIPC
    </button>
  );
}
