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

  if (!isConfigured) {
    // In demo/offline mode, read active demo role from cookie if set
    const demoRole = request.cookies.get('mipc_demo_role')?.value;

    const demoUser = demoRole
      ? { id: `user-${demoRole}-1`, email: `${demoRole}@mipc.ac.rw` }
      : null;

    return { response, supabase: null, user: demoUser };
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
    return { response, supabase, user };
  } catch {
    return { response, supabase: null, user: null };
  }
}
