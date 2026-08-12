import { NextRequest, NextResponse } from 'next/server';
import { createClient, isDemoModeEnabled, isSupabaseConfigured } from '@/lib/supabase/server';
import { submitAndGradeAttempt } from '@/lib/test-attempts';
import { dataStore } from '@/lib/data-store';
import { jsonBodySize, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    await enforceRateLimit(`exam-submit:${clientAddress(request)}`, 15, 60_000);
    jsonBodySize(request, 2_000_000);

    const body = await request.json().catch(() => ({}));
    let answerEntries: { questionId: string; response: string }[] = [];

    if (Array.isArray(body.answers)) {
      answerEntries = body.answers;
    } else if (body.answers && typeof body.answers === 'object') {
      answerEntries = Object.entries(body.answers).map(([questionId, response]) => ({
        questionId,
        response: String(response)
      }));
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await (supabase as any).rpc('submit_test_attempt', {
          target_test_id: testId,
          submitted_answers: answerEntries
        });
        const result = Array.isArray(data) ? data[0] : data;
        if (error || !result) {
          console.error('Exam submission failed', { code: error?.code, userId: user.id, testId });
          return NextResponse.json({ error: 'Your examination could not be submitted. Your saved answers are still available.' }, { status: 409 });
        }
        return NextResponse.json({
          ok: true,
          status: result.status,
          score: result.score,
          requiresManualGrading: result.requires_manual_grading
        });
      } catch {
        return NextResponse.json({ error: 'The examination service is temporarily unavailable.' }, { status: 503 });
      }
    }

    if (!isDemoModeEnabled()) {
      return NextResponse.json({ error: 'The examination service is temporarily unavailable.' }, { status: 503 });
    }

    const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'student');
    const attempt = dataStore.test_attempts.find(
      (a) => a.test_id === testId && a.student_id === currentStudent?.id
    );

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Attempt already closed', status: attempt.status }, { status: 409 });
    }

    const result = await submitAndGradeAttempt(attempt.id, answerEntries);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    if (err instanceof Error && err.message === 'RATE_LIMITED') return NextResponse.json({ error: 'Too many submission requests. Try again shortly.' }, { status: 429 });
    if (err instanceof Error && (err.message === 'RATE_LIMIT_UNAVAILABLE' || err.message === 'BACKEND_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'The examination service is temporarily unavailable.' }, { status: 503 });
    }
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: 'The examination could not be submitted.' }, { status: 500 });
  }
}
