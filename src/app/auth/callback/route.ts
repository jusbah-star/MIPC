import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safePortalNext } from '@/lib/auth-policy';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role, account_status').eq('id', data.user.id).single();
        if (profileError || !profile || (profile as any).account_status !== 'active') {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=account_unavailable`);
        }
        const destination = safePortalNext(profile as any, rawNext);
        return NextResponse.redirect(`${origin}${destination}`);
      }
    } catch {}
  }
  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}
