import { NextResponse } from 'next/server';
import { createClient, isDemoModeEnabled, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore, saveAnswerDraft } from '@/lib/data-store';
import { jsonBodySize, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

export async function PUT(request: Request, { params }: { params: Promise<{ testId: string }> }) {
  try {
    const { testId } = await params;
    jsonBodySize(request, 2_000_000);
    const body = await request.json();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    if (answers.length > 250) return NextResponse.json({ error: 'Too many answers.' }, { status: 400 });

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

      // Campus Wi-Fi can put hundreds of students behind one public IP. Limit
      // authenticated exam traffic per student so a shared NAT never blocks a room.
      await enforceRateLimit(`exam-save:user:${user.id}`, 90, 60_000);

      const { data, error } = await (supabase as any).rpc('save_test_answers', {
        target_test_id: testId,
        submitted_answers: answers
      });
      if (error) return NextResponse.json({ error: 'Answers could not be saved.' }, { status: 409 });
      return NextResponse.json({ ok: true, saved: data });
    }

    if (!isDemoModeEnabled()) {
      return NextResponse.json({ error: 'The examination service is temporarily unavailable.' }, { status: 503 });
    }

    await enforceRateLimit(`exam-save:demo:${clientAddress(request)}`, 180, 60_000);
    const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'student');
    const attempt = dataStore.test_attempts.find(
      (item) => item.test_id === testId && item.student_id === currentStudent?.id && item.status === 'in_progress'
    );
    if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    answers.forEach((answer: any) => {
      if (typeof answer.questionId === 'string' && typeof answer.response === 'string') {
        const belongsToTest = dataStore.questions.some((question) => question.id === answer.questionId && question.test_id === testId);
        if (belongsToTest) saveAnswerDraft(attempt.id, answer.questionId, answer.response.slice(0, 10000));
      }
    });
    return NextResponse.json({ ok: true, saved: answers.length, mode: 'demo' });
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') return NextResponse.json({ error: 'Answers are being saved too frequently.' }, { status: 429 });
    if (error instanceof Error && (error.message === 'RATE_LIMIT_UNAVAILABLE' || error.message === 'BACKEND_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'The examination service is temporarily unavailable.' }, { status: 503 });
    }
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Answers could not be saved.' }, { status: 500 });
  }
}
