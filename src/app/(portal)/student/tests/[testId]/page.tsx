import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { startOrResumeAttempt } from '@/lib/test-attempts';
import { dataStore } from '@/lib/data-store';
import TestRunner from './test-runner';
import {
  ClockIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  AwardIcon
} from '@/components/icons';

export default async function TakeTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const connected = isSupabaseConfigured();
  const currentStudent = dataStore.currentUser ?? dataStore.profiles.find((p) => p.role === 'student');
  let studentId = currentStudent?.id ?? 'user-student-1';
  let supabase: any = null;

  if (connected) {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    studentId = user.id;
  }

  let test: any = connected ? null : dataStore.tests.find((t) => t.id === testId) ?? null;
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
      <div className="mx-auto max-w-xl rounded-2xl border border-signal-warn/30 bg-white p-8 text-center shadow-academic">
        <AlertCircleIcon className="mx-auto h-10 w-10 text-signal-warn" />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-950">Examination unavailable</h1>
        <p className="mt-2 text-sm text-ink-700">{result.error}</p>
        <Link href="/student/tests" className="mt-6 inline-flex rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white">
          Return to examinations
        </Link>
      </div>
    );
  }

  const res = result as any;
  if (res.status !== 'in_progress') {
    const isPassed = typeof res.score === 'number' && res.score >= (test.passing_score ?? 50);

    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-ink-900/10 p-8 shadow-academic text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isPassed ? 'bg-signal-ok-bg text-signal-ok' : 'bg-parchment-200 text-ink-700'
            }`}
          >
            {isPassed ? <CheckCircleIcon className="w-10 h-10" /> : <AwardIcon className="w-10 h-10" />}
          </div>

          <span className="text-xs font-mono uppercase tracking-widest text-brass-600 font-semibold block mb-1">
            Examination Summary
          </span>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {test.title}
          </h1>

          <div className="mt-6 inline-flex items-baseline gap-2 bg-parchment-50 border border-parchment-300 rounded-xl px-6 py-4">
            <span className="text-xs font-mono uppercase text-ink-500">Achieved Score:</span>
            <span className="font-display text-3xl font-bold text-ink-950">
              {res.requiresManualGrading ? 'Pending' : `${res.score ?? 0}%`}
            </span>
            <span className="text-xs font-mono text-ink-500">
              (Pass mark: {test.passing_score ?? 50}%)
            </span>
          </div>

          <p className="mt-4 text-sm text-ink-700 leading-relaxed font-mono">
            Status: <strong className="text-ink-950 font-semibold uppercase">{res.status.replace('_', ' ')}</strong>
            {res.requiresManualGrading ? ' · Essay responses are awaiting faculty review.' : ' · All responses are recorded.'}
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/student/tests"
              className="rounded-lg bg-ink-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-ink-800 transition-colors shadow-sm"
            >
              Return to Examination Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch stripped questions
  let questions = dataStore.questions
    .filter((q) => q.test_id === testId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      points: q.points,
      order_index: q.order_index
    }));

  let initialAnswers: { question_id: string; response: string | null }[] = [];

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data: dbQuestions } = await supabase.rpc('get_student_questions', {
        target_test_id: testId
      } as any);

      if (dbQuestions && dbQuestions.length > 0) {
        questions = dbQuestions as any;
      }

      const { data: existingAnswers } = await supabase
        .from('answers')
        .select('question_id, response')
        .eq('attempt_id', res.attemptId);

      if (existingAnswers) {
        initialAnswers = existingAnswers;
      }
    } catch {
      // Fallback
    }
  } else {
    const existingAnswers = dataStore.answers.filter((a) => a.attempt_id === res.attemptId);
    initialAnswers = existingAnswers.map((a) => ({
      question_id: a.question_id,
      response: a.response
    }));
  }

  return (
    <TestRunner
      testId={testId}
      testTitle={test.title}
      attemptId={res.attemptId}
      expiresAt={res.expiresAt}
      questions={questi