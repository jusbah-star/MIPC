import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project-ref')
  );
  const demoEnabled = Boolean(
    !isConfigured &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_MIPC_DEMO_MODE === 'true'
  );

  if (!isConfigured) {
    const demoRole = demoEnabled ? request.cookies.get('mipc_demo_role')?.value : undefined;
    const demoUser = demoRole
      ? { id: `user-${demoRole}-1`, email: `${demoRole}@mipc.ac.rw` }
      : null;

    return { response, supabase: null, user: demoUser, demoEnabled, configured: false };
  }

  try {
    const supabase = createServerClient<Database>(
      supabaseUrl!,
      supabaseKey!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          }
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    return { response, supabase, user, demoEnabled: false, configured: true };
  } catch {
    return { response, supabase: null, user: null, demoEnabled: false, configured: true };
  }
}
