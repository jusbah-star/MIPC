'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { gradeAssignmentSubmission } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';

export async function recordGrade(formData: FormData) {
  const connected = isSupabaseConfigured();
  const rawSubmissionId = requiredText(formData.get('submission_id'), 'Submission', 64);
  const submissionId = connected ? uuid(rawSubmissionId, 'Submission') : rawSubmissionId;
  const rawGrade = String(formData.get('grade') ?? '').trim();
  const grade = Number(rawGrade);
  if (!rawGrade || !Number.isFinite(grade) || grade < 0) throw new ValidationError('Enter a valid grade.');
  const feedback = optionalText(formData.get('feedback'), 'Feedback', 5000) ?? '';

  if (connected) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { error } = await supabase.rpc('grade_assignment' as any, {
      target_submission_id: submissionId,
      awarded_grade: grade,
      marker_feedback: feedback
    } as any);
    if (error) throw new Error(error.message);
  } else {
    gradeAssignmentSubmission(submissionId, grade, feedback);
  }

  revalidatePath('/lecturer/grading');
}
