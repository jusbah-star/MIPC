'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { approveApplicationInStore, rejectApplicationInStore } from '@/lib/data-store';
import { uuid } from '@/lib/validation';

async function assertAdmin() {
  if (!isSupabaseConfigured()) return { id: 'user-admin-1' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (error || (profile as any)?.role !== 'admin') throw new Error('Administrator authorization required.');
  return user;
}

function refreshAdmissions() {
  revalidatePath('/admin/applications');
  revalidatePath('/admin');
  revalidatePath('/admin/users');
}

export async function approveApplication(rawApplicationId: string) {
  const actor = await assertAdmin();
  if (!isSupabaseConfigured()) {
    await approveApplicationInStore(rawApplicationId, actor.id);
    refreshAdmissions();
    return;
  }

  const applicationId = uuid(rawApplicationId, 'Application');
  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin.from('applications').select('email').eq('id', applicationId).eq('status', 'pending').single();
  if (applicationError || !application) throw new Error('Pending application not found.');

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail((application as any).email);
  if (inviteError || !invited.user) throw new Error(inviteError?.message ?? 'Unable to create the student invitation.');

  const { error: approvalError } = await admin.rpc('approve_application' as any, {
    target_application_id: applicationId,
    invited_user_id: invited.user.id,
    reviewer_id: actor.id
  } as any);
  if (approvalError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    throw new Error(approvalError.message);
  }
  refreshAdmissions();
}

export async function rejectApplication(rawApplicationId: string) {
  const actor = await assertAdmin();
  if (!isSupabaseConfigured()) {
    await rejectApplicationInStore(rawApplicationId, actor.id);
    refreshAdmissions();
    return;
  }
  const applicationId = uuid(rawApplicationId, 'Application');
  const admin = createAdminClient();
  const { error } = await admin.rpc('reject_application' as any, { target_application_id: applicationId, reviewer_id: actor.id } as any);
  if (error) throw new Error(error.message);
  refreshAdmissions();
}
