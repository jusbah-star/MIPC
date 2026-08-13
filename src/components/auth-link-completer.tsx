'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'thetesemuragije@gmail.com';

export function AuthLinkCompleter() {
  const router = useRouter();

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const sessionAccess = fragment.get('access_token');
    const sessionRefresh = fragment.get('refresh_token');
    if (!sessionAccess || !sessionRefresh) return;

    let cancelled = false;

    async function complete() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: sessionAccess!,
        refresh_token: sessionRefresh!
      });

      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (cancelled || error || !data.user?.email) {
        router.replace('/login?error=invalid_email_link');
        return;
      }

      const email = data.user.email.trim().toLowerCase();
      if (email === ADMIN_EMAIL) {
        const name = typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : 'MIPC Administrator';
        const response = await fetch('/api/auth/register-admin/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: name })
        });
        if (!response.ok) {
          router.replace('/register/admin?error=finalize');
          return;
        }
        router.replace('/admin');
        router.refresh();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', data.user.id)
        .single();

      if (!profile || (profile as any).account_status !== 'active') {
        await supabase.auth.signOut();
        router.replace('/login?error=account_unavailable');
        return;
      }

      router.replace(`/${(profile as any).role}`);
      router.refresh();
    }

    void complete();
    return () => { cancelled = true; };
  }, [router]);

  return null;
}
