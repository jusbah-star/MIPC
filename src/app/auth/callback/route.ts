import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');

  // Sanitize next redirect target to prevent open redirect
  let safeNext: string | null = null;
  if (rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')) {
    safeNext = rawNext;
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const destination = safeNext ?? (profile ? `/${(profile as any).role}` : '/login?error=no-profile');
        return NextResponse.redirect(`${origin}${destination}`);
      }
    } catch {
      // Return below
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`);
}
