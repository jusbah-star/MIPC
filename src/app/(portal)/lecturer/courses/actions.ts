'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { MaterialType } from '@/lib/database.types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';

export async function publishCourseMaterial(formData: FormData) {
  const connected = isSupabaseConfigured();
  const rawCourseId = requiredText(formData.get('course_id'), 'Course', 64);
  const courseId = connected ? uuid(rawCourseId, 'Course') : rawCourseId;
  const title = requiredText(formData.get('title'), 'Material title', 180, 3);
  const description = optionalText(formData.get('description'), 'Description', 3000);
  const kind = requiredText(formData.get('material_type'), 'Material type', 20) as MaterialType;
  if (!['document', 'link', 'note'].includes(kind)) throw new ValidationError('Material type is invalid.');
  const resourceUrl = optionalText(formData.get('resource_url'), 'Resource URL', 2000);
  const content = optionalText(formData.get('content'), 'Material content', 20000);
  if (!resourceUrl && !content) throw new ValidationError('Add a secure resource link or material content.');
  if (resourceUrl) {
    let parsed: URL;
    try { parsed = new URL(resourceUrl); } catch { throw new ValidationError('Enter a valid HTTPS resource URL.'); }
    if (parsed.protocol !== 'https:') throw new ValidationError('Resource links must use HTTPS.');
  }
  const published = formData.get('published') === 'on';

  if (connected) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { error } = await (supabase as any).rpc('publish_course_material', {
      target_course_id: courseId,
      material_title: title,
      material_description: description,
      material_kind: kind,
      material_url: resourceUrl,
      material_content: content,
      publish_now: published
    });
    if (error) throw new Error(error.message);
  } else {
    const course = dataStore.courses.find((item) => item.id === courseId && item.lecturer_id === 'user-lecturer-1');
    if (!course) throw new ValidationError('Course not found.');
    dataStore.course_materials.unshift({
      id: `material-${Date.now()}`,
      course_id: courseId,
      title,
      description,
      material_type: kind,
      resource_url: resourceUrl,
      content,
      published,
      created_by: 'user-lecturer-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  revalidatePath('/lecturer/courses');
  revalidatePath('/student/courses');
}
