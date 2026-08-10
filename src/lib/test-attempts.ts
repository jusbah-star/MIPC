import type { SupabaseClient } from '@supabase/supabase-js';
import { dataStore } from './data-store';
import type { AttemptStatus } from './database.types';

export type AttemptResult =
  | { ok: true; attemptId: string; expiresAt: string; status: 'in_progress' }
  | { ok: true; attemptId: string; expiresAt: string; status: 'submitted' | 'auto_submitted' | 'graded'; score: number | null; requiresManualGrading?: boolean }
  | { ok: false; error: string; statusCode: number };

export async function startOrResumeAttempt(
  supabase: SupabaseClient | null,
  testId: string,
  userId: string
): Promise<AttemptResult> {
  // If Supabase client with valid URL is present, query Supabase
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref')
  );

  if (supabase && isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('start_test_attempt', { target_test_id: testId });
      const attempt = Array.isArray(data) ? data[0] : data;
      if (error || !attempt) {
        return { ok: false, error: 'This examination is unavailable or you are not enrolled.', statusCode: 403 };
      }
      if (attempt.status === 'in_progress') {
        return { ok: true, attemptId: attempt.attempt_id, expiresAt: attempt.expires_at, status: 'in_progress' };
      }
      return {
        ok: true,
        attemptId: attempt.attempt_id,
        expiresAt: attempt.expires_at,
        status: attempt.status,
        score: attempt.score,
        requiresManualGrading: attempt.requires_manual_grading
      };
    } catch {
      return { ok: false, error: 'The examination service is temporarily unavailable.', statusCode: 503 };
    }
  }

  // Standalone / Local Data Store Logic
  const existing = dataStore.test_attempts.find(
    (a) => a.test_id === testId && a.student_id === userId
  );

  if (existing) {
    if (existing.status !== 'in_progress') {
      return {
        ok: true,
        attemptId: existing.id,
        expiresAt: existing.expires_at,
        status: existing.status as 'submitted' | 'auto_submitted' | 'graded',
        score: existing.score
      };
    }
    return { ok: true, attemptId: existing.id, expiresAt: existing.expires_at, status: 'in_progress' };
  }

  const test = dataStore.tests.find((t) => t.id === testId);
  if (!test || !test.published) {
    return { ok: false, error: 'Test not found or unpublished', statusCode: 404 };
  }

  const now = new Date();
  if (now < new Date(test.available_from) || now > new Date(test.available_until)) {
    return { ok: false, error: 'Test is not currently open', statusCode: 403 };
  }

  const nominalExpiry = now.getTime() + test.duration_minutes * 60_000;
  const hardClose = new Date(test.available_until).getTime();
  const expiresAt = new Date(Math.min(nominalExpiry, hardClose));

  const newAttempt = {
    id: `attempt-${Date.now()}`,
    test_id: testId,
    student_id: userId,
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    submitted_at: null,
    status: 'in_progress' as AttemptStatus,
    score: null,
    requires_manual_grading: false
  };

  dataStore.test_attempts.push(newAttempt);
  return { ok: true, attemptId: newAttempt.id, expiresAt: newAttempt.expires_at, status: 'in_progress' };
}

export async function submitAndGradeAttempt(
  attemptId: string,
  answers: { questionId: string; response: string }[]
) {
  const attempt = dataStore.test_attempts.find((a) => a.id === attemptId);
  if (!attempt) throw new Error('Attempt not found');
  if (attempt.status !== 'in_progress') throw new Error('Attempt already submitted');

  const now = new Date();
  const isOnTime = now <= new Date(attempt.expires_at);

  attempt.status = isOnTime ? 'submitted' : 'auto_submitted';
  attempt.submitted_at = now.toISOString();

  // Save / upsert answers in data store
  let awardedPoints = 0;
  const test = dataStore.tests.find((item) => item.id === attempt.test_id);
  const testQuestions = dataStore.questions.filter((item) => item.test_id === attempt.test_id);
  const totalPoints = testQuestions.reduce((sum, item) => sum + Number(item.points), 0);
  const requiresManualGrading = testQuestions.some((item) => item.type === 'essay');
  answers.forEach((ans) => {
    const question = dataStore.questions.find((q) => q.id === ans.questionId);
    let pointsAwarded: number | null = null;

    if (question) {
      if (question.type === 'mcq' || question.type === 'short_answer') {
        const isMatch =
          question.correct_answer &&
          ans.response &&
          ans.response.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        pointsAwarded = isMatch ? Number(question.points) : 0;
        awardedPoints += pointsAwarded;
      } else {
        // Essay question: remains un-graded until lecturer review
        pointsAwarded = null;
      }
    }

    const existingAnsIndex = dataStore.answers.findIndex(
      (a) => a.attempt_id === attemptId && a.question_id === ans.questionId
    );

    const answerRow = {
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      attempt_id: attemptId,
      question_id: ans.questionId,
      response: ans.response,
      points_awarded: pointsAwarded
    };

    if (existingAnsIndex >= 0) {
      dataStore.answers[existingAnsIndex] = answerRow;
    } else {
      dataStore.answers.push(answerRow);
    }
  });

  const percentage = totalPoints > 0 ? Math.round((awardedPoints / totalPoints) * 10_000) / 100 : 0;
  attempt.score = percentage;
  (attempt as any).requires_manual_grading = requiresManualGrading;
  return { status: attempt.status, score: percentage, requiresManualGrading, passingScore: (test as any)?.passing_score ?? 50 };
}
