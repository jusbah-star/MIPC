import { redirect } from 'next/navigation';
import type { AccountRole } from '@/lib/roles';
import { isAccountRole } from '@/lib/roles';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function requireActiveGovernanceRole(allowed: AccountRole[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, account_status, department_id, full_name, email')
    .eq('id', user.id)
    .single();
  const p = profile as any;
  if (error || !p || p.account_status !== 'active' || !isAccountRole(p.role) || !allowed.includes(p.role)) {
    throw new Error('This MIPC workspace is not authorized for your account.');
  }
  return { user, profile: p as { id: string; role: AccountRole; account_status: string; department_id: string | null; full_name: string; email: string }, admin: createAdminClient() as any };
}
