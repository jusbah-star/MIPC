'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { profilePortalDestination } from '@/lib/auth-policy';

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function confirmEmailLink(formData: FormData) {
  const tokenHash = field(formData, 'token_hash');
  const type = field(formData, 'type');

  if (!tokenHash || tokenHash.length > 512 || type !== 'email') {
    redirect('/login?error=invalid_email_link');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email'
  });

  if (error || !data.user) {
    redirect('/login?error=email_link_expired');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile || (profile as any).account_status !== 'active') {
    await supabase.auth.signOut();
    redirect('/login?error=account_unavailable');
  }

  redirect(profilePortalDestination(profile as any));
}
