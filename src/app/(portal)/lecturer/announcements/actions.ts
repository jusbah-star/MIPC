'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addAnnouncement } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { requiredText, uuid } from '@/lib/validation';

export async function publishCourseAnnouncement(formData: FormData) {
  const connected = isSupabaseConfigured();
  const rawCourseId = requiredText(formData.get('course_id'), 'Course', 64);
  const courseId = connected ? uuid(rawCourseId, 'Course') : rawCourseId;
  const title = requiredText(formData.get('title'), 'Headline', 180, 4);
  const body = requiredText(formData.get('body'), 'Announcement', 5000, 10);

  if (connected) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { error } = await supabase.from('announcements').insert({
      scope: 'course',
      course_id: courseId,
      title,
      body,
      author_id: user.id
    } as any);
    if (error) throw new Error(error.message);
  } else {
    addAnnouncement({ scope: 'course', course_id: courseId, title, body });
  }

  revalidatePath('/lecturer/announcements');
  revalidatePath('/announcements');
}
