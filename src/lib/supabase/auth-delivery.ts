import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function createAuthDeliveryClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project-ref')) {
    throw new Error('Supabase authentication is not configured');
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      flowType: 'implicit'
    }
  });
}
