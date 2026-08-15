import { redirect } from 'next/navigation';
import type { AccountRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/server';
import { getPortalSession } from '@/lib/portal-session';

export async function requireActiveGovernanceRole(allowed: AccountRole[]) {
  const session = await getPortalSession();
  if (!session) redirect('/login');
  const { user, profile } = session;
  if (profile.account_status !== 'active' || !allowed.includes(profile.role)) {
    throw new Error('This MIPC workspace is not authorized for your account.');
  }
  return {
    user,
    profile,
    admin: createAdminClient() as any
  };
}
