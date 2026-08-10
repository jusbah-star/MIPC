'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { AccountStatus, UserRole } from '@/lib/database.types';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { requiredText, uuid, ValidationError } from '@/lib/validation';

export async function updateUserAccess(formData: FormData) {
  const connected = isSupabaseConfigured();
  const rawUserId = requiredText(formData.get('user_id'), 'User', 64);
  const userId = connected ? uuid(rawUserId, 'User') : rawUserId;
  const role = requiredText(formData.get('role'), 'Role', 20) as UserRole;
  const status = requiredText(formData.get('account_status'), 'Account status', 20) as AccountStatus;
  if (!['student', 'lecturer', 'admin'].includes(role)) throw new ValidationError('Role is invalid.');
  if (!['active', 'suspended'].includes(status)) throw new ValidationError('Account status is invalid.');

  if (connected) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { data: profile } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).single();
    if ((profile as any)?.role !== 'admin' || (profile as any)?.account_status !== 'active') throw new Error('Administrator authorization required.');
    const admin = createAdminClient();
    const { error } = await (admin as any).rpc('admin_update_user', {
      target_user_id: userId,
      new_role: role,
      new_status: status,
      reviewer_id: user.id
    });
    if (error) throw new Error(error.message);
  } else {
    const target = dataStore.profiles.find((item) => item.id === userId);
    if (!target) throw new ValidationError('User not found.');
    if (target.id === 'user-admin-1' && (role !== 'admin' || status !== 'active')) throw new ValidationError('The demonstration administrator cannot remove their own access.');
    target.role = role;
    target.account_status = status;
    dataStore.audit_log.unshift({ id: Date.now(), actor_id: 'user-admin-1', action: 'user.access.update', target_table: 'profiles', target_id: userId, old_value: null, new_value: { role, account_status: status }, created_at: new Date().toISOString() });
  }
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
}
