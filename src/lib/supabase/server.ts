import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

const defaultUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const defaultAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const defaultService = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref')
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    defaultUrl,
    defaultAnon,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in read-only render contexts
          }
        }
      }
    }
  );
}

export function createAdminClient() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin credentials are not configured');
  }

  return createSupabaseClient<Database>(defaultUrl, defaultService, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
