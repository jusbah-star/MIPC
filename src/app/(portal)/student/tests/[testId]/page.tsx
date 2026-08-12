import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { startOrResumeAttempt } from '@/lib/test-attempts';
import { dataStore } from '@/lib/data-store';
import TestRunner from './test-runner';
import { AlertCircleIcon, AwardIcon, CheckCircleIcon } from '@/components/icons';

export default async function TakeTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const connected = isSupabaseConfigured();
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((profile) => profile.role === 'student');
  let studentId = currentStudent?.id ?? 'user-student-1';
  let supabase: any = null;

  if (connected) {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    studentId = user.id;
  }

  let test: any = connected ? null : dataStore.tests.find((item) => item.id === testId) ?? null;
  if (connected) {
    const { data: dbTest, error } = await supabase
      .from('tests')
      .select('id, title, description, duration_minutes, passing_score, available_from, available_until')
      .eq('id', testId)
      .maybeSingle();
    if (error) throw new Error('The examination could not be loaded.');
    test = dbTest;
  }
  if (!test) redirect('/student/tests');

  const result = await startOrResumeAttempt(supabase as any, testId, studentId);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-xl py-8 sm:py-12">
        <div className="rounded-3xl border border-signal-warn/15 bg-white p-7 text-center shadow-academic sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-signal-warn-bg text-signal-warn"><AlertCircleIcon className="h-7 w-7" /></span>
          <p className="mt-6 text-xs font-semibold text-signal-warn">Examination unavailable</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-ink-950">You can&apos;t open this assessment right now.</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">{result.error}</p>
          <Link href="/student/tests" className="mipc-button-primary mt-7">Return to examinations</Link>
        </div>
      </div>
    );
  }

  const res = result as any;
  if (res.status !== 'in_progress') {
    const isPassed = typeof res.score === 'number' && res.score >= (test.passing_score ?? 50);

    return (
      <div className="mx-auto max-w-2xl py-8 sm:py-12">
        <div className="rounded-3xl border border-ink-900/[0.08] bg-white p-7 text-center shadow-academic-lg sm:p-10">
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${isPassed ? 'bg-signal-ok-bg text-signal-ok' : 'bg-parchment-200 text-ink-600'}`}>
            {isPassed ? <CheckCircleIcon className="h-7 w-7" /> : <AwardIcon className="h-7 w-7" />}
          </span>
          <p className="mt-6 text-xs font-semibold text-mipc-green-700">Examination complete</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-ink-950 sm:text-4xl">{test.title}</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">Your responses have been recorded.</p>

          <div className="mx-auto mt-7 max-w-md rounded-2xl bg-parchment-50 p-5">
            <p className="text-xs font-medium text-ink-400">Result</p>
            <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink-950">{res.requiresManualGrading ? 'Pending' : `${res.score ?? 0}%`}</p>
            <p className="mt-1 text-xs text-ink-500">Pass mark: {test.passing_score ?? 50}%</p>
          </div>

          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-ink-600">
            {res.requiresManualGrading ? 'Essay responses are waiting for lecturer review before the final score is released.' : isPassed ? 'You achieved the required pass mark.' : 'Your result is below the current pass mark. Review feedback when it becomes available.'}
          </p>

          <Link href="/student/tests" className="mipc-button-primary mt-7">Back to examinations</Link>
        </div>
      </div>
    );
  }

  let questions = (connected ? [] : dataStore.questions)
    .filter((question) => question.test_id === testId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      order_index: question.order_index
    }));

  let initialAnswers: { question_id: string; response: string | null }[] = [];

  if (connected) {
    const { data: dbQuestions, error: questionError } = await supabase.rpc('get_student_questions', { target_test_id: testId } as any);
    if (questionError) throw new Error('Examination questions could not be loaded.');
    questions = (dbQuestions ?? []) as any;

    const { data: existingAnswers, error: answerError } = await supabase
      .from('answers')
      .select('question_id, response')
      .eq('attempt_id', res.attemptId);
    if (answerError) throw new Error('Saved responses could not be loaded.');
    initialAnswers = existingAnswers ?? [];
  } else {
    const existingAnswers = dataStore.answers.filter((answer) => answer.attempt_id === res.attemptId);
    initialAnswers = existingAnswers.map((answer) => ({ question_id: answer.question_id, response: answer.response }));
  }

  return (
    <TestRunner
      testId={testId}
      testTitle={test.title}
      attemptId={res.attemptId}
      expiresAt={res.expiresAt}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}
