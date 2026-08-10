'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addAnnouncement } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { requiredText, ValidationError } from '@/lib/validation';

export async function publishGlobalAnnouncement(formData: FormData) {
  const scope = requiredText(formData.get('scope'), 'Audience', 20) as 'public' | 'college';
  if (!['public', 'college'].includes(scope)) throw new ValidationError('Audience is invalid.');
  const title = requiredText(formData.get('title'), 'Headline', 180, 4);
  const body = requiredText(formData.get('body'), 'Announcement', 5000, 10);

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { error } = await (supabase as any).rpc('publish_global_announcement', {
      announcement_kind: scope,
      announcement_title: title,
      announcement_body: body
    });
    if (error) throw new Error(error.message);
  } else {
    addAnnouncement({ scope, title, body, author_id: 'user-admin-1' });
  }
  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
  revalidatePath('/');
}
