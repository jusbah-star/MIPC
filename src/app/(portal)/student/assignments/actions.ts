'use server';
import { revalidatePath } from 'next/cache';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore, submitAssignmentSolution } from '@/lib/data-store';
import { requiredText } from '@/lib/validation';

export async function submitCoursework(formData: FormData) {
  const assignmentId = requiredText(formData.get('assignmentId'), 'Assignment', 64);
  const content = requiredText(formData.get('content'), 'Submission', 20000);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to submit coursework.');
    const { error } = await supabase.rpc('submit_assignment', { target_assignment_id: assignmentId, response_content: content } as any);
    if (error) throw new Error('Coursework could not be submitted.');
  } else {
    const student = dataStore.currentUser?.role === 'student' ? dataStore.currentUser : dataStore.profiles.find((item) => item.role === 'student');
    if (!student) throw new Error('Demo student is unavailable.');
    submitAssignmentSolution(assignmentId, student.id, content);
  }
  revalidatePath('/student/assignments');
}
