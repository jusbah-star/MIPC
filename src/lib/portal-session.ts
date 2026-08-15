import 'server-only';
import { cache } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import type { AccountRole } from '@/lib/roles';
import { isAccountRole } from '@/lib/roles';

export type PortalSessionProfile = {
  id: string;
  role: AccountRole;
  account_status: string;
  department_id: string | null;
  full_name: string;
  email: string;
};

// React.cache is request-scoped in Server Components. The portal layout and
// page can safely call this independently without repeating Auth + profile I/O.
export const getPortalSession = cache(async () => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,account_status,department_id,full_name,email')
    .eq('id', user.id)
    .single();

  const p = profile as any;
  if (profileError || !p || !isAccountRole(p.role)) return null;

  return {
    supabase,
    user,
    profile: p as PortalSessionProfile
  };
});
