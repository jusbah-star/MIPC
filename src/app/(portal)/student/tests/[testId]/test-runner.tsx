'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircleIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';

type Question = {
  id: string;
  type: 'mcq' | 'short_answer' | 'essay';
  prompt: string;
  options: { id: string; label: string }[] | null;
  points: number;
  order_index: number;
};

type Props = {
  testId: string;
  testTitle: string;
  attemptId: string;
  expiresAt: string;
  questions: Question[];
  initialAnswers: { question_id: string; response: string | null }[];
};

export default function TestRunner({ testId, testTitle, expiresAt, questions, initialAnswers }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialAnswers.map((answer) => [answer.question_id, answer.response ?? '']))
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [submitError, setSubmitError] = useState('');
  const submittedRef = useRef(false);

  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - Date.now()));

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, response]) => ({ questionId, response }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Submission failed');
      router.push(`/student/tests/${testId}?submitted=1`);
      router.refresh();
    } catch {
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError('We could not submit the examination. Your saved responses remain available; please try again.');
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0 && !submittedRef.current) {
        window.clearInterval(interval);
        void handleSubmit();
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // handleSubmit intentionally uses the latest render state when the timer expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const entries = Object.entries(answers);
      if (!entries.length) return;

      setSaveStatus('saving');
      try {
        const response = await fetch(`/api/tests/${testId}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: entries.map(([questionId, response]) => ({ questionId, response }))
          })
        });
        if (!response.ok) throw new Error('Save failed');
        setSubmitError('');
      } catch {
        setSubmitError('Autosave is temporarily unavailable. Keep this page open and try again.');
      } finally {
        setSaveStatus('saved');
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [answers, testId]);

  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  const isUrgent = remainingMs < 120_000;
  const answeredCount = Object.values(answers).filter((value) => value && value.trim().length > 0).length;
  const currentQuestion = questions[activeIdx];
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {submitError ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-signal-danger/15 bg-signal-danger-bg px-4 py-3.5 text-sm leading-6 text-signal-danger">
          <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <header className="sticky top-[84px] z-20 overflow-hidden rounded-2xl border border-ink-900/[0.09] bg-white/95 shadow-academic-lg backdrop-blur-xl lg:top-[88px]">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isUrgent ? 'bg-signal-danger-bg text-signal-danger' : 'bg-mipc-green-50 text-mipc-green-700'}`}>
              <ClockIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-950 sm:text-base">{testTitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                <span>{answeredCount} of {questions.length} answered</span>
                <span className="inline-flex items-center gap-1.5 text-mipc-green-700"><span className="h-1.5 w-1.5 rounded-full bg-mipc-green-500" /> {saveStatus === 'saving' ? 'Saving…' : 'Autosaved'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <div className={`rounded-xl border px-3.5 py-2 text-center ${isUrgent ? 'border-signal-danger/20 bg-signal-danger-bg text-signal-danger' : 'border-ink-900/[0.08] bg-parchment-100 text-ink-950'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-65">Time left</p>
              <p className="mt-0.5 font-display text-xl font-extrabold tabular-nums tracking-tight">{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</p>
            </div>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="mipc-button-primary min-h-12 px-4 sm:px-5">
              {submitting ? 'Submitting…' : 'Submit exam'}
            </button>
          </div>
        </div>
        <div className="h-1 bg-parchment-200">
          <div className="h-full bg-mipc-green-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[190px] lg:self-start">
          <div className="rounded-2xl border border-ink-900/[0.08] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink-900">Questions</p>
              <span className="text-xs text-ink-400">{progress}% complete</span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 lg:grid-cols-4">
              {questions.map((question, index) => {
                const isAnswered = Boolean(answers[question.id]?.trim());
                const isCurrent = activeIdx === index;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setActiveIdx(index)}
                    aria-label={`Go to question ${index + 1}${isAnswered ? ', answered' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`grid h-10 place-items-center rounded-xl text-xs font-semibold transition ${
                      isCurrent
                        ? 'bg-mipc-green-900 text-white shadow-xs'
                        : isAnswered
                          ? 'border border-mipc-green-700/10 bg-mipc-green-50 text-mipc-green-700'
                          : 'bg-parchment-100 text-ink-500 hover:bg-parchment-200 hover:text-ink-800'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 border-t border-ink-900/[0.07] pt-4 text-xs leading-5 text-ink-500">
              <p>Your responses save automatically every 10 seconds.</p>
            </div>
          </div>
        </aside>

        {currentQuestion ? (
          <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-5 shadow-academic sm:p-7 lg:p-8" aria-labelledby="current-question">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/[0.07] pb-5">
              <div>
                <p className="text-xs font-semibold text-mipc-green-700">Question {activeIdx + 1} of {questions.length}</p>
                <p className="mt-1 text-xs text-ink-400">{currentQuestion.points} point{currentQuestion.points === 1 ? '' : 's'} · {currentQuestion.type.replace('_', ' ')}</p>
              </div>
              {answers[currentQuestion.id]?.trim() ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok"><CheckCircleIcon className="h-3.5 w-3.5" /> Answered</span>
              ) : null}
            </div>

            <h1 id="current-question" className="mt-6 max-w-3xl text-xl font-bold leading-8 tracking-[-0.02em] text-ink-950 sm:text-2xl sm:leading-9">{currentQuestion.prompt}</h1>

            {currentQuestion.type === 'mcq' && currentQuestion.options ? (
              <fieldset className="mt-7 space-y-3">
                <legend className="sr-only">Choose one answer</legend>
                {currentQuestion.options.map((option) => {
                  const isSelected = answers[currentQuestion.id] === option.id;
                  return (
                    <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition sm:p-5 ${isSelected ? 'border-mipc-green-600/35 bg-mipc-green-50' : 'border-ink-900/[0.08] bg-white hover:border-ink-900/15 hover:bg-parchment-50'}`}>
                      <input
                        type="radio"
                        name={currentQuestion.id}
                        value={option.id}
                        checked={isSelected}
                        onChange={() => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: option.id }))}
                        className="mt-1 h-4 w-4 shrink-0 accent-mipc-green-700"
                      />
                      <span className="text-sm font-medium leading-6 text-ink-800">{option.label}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : null}

            {currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay' ? (
              <div className="mt-7">
                <label className="mipc-label" htmlFor={`answer-${currentQuestion.id}`}>Your answer</label>
                <textarea
                  id={`answer-${currentQuestion.id}`}
                  value={answers[currentQuestion.id] ?? ''}
                  onChange={(event) => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: event.target.value }))}
                  rows={currentQuestion.type === 'essay' ? 10 : 4}
                  placeholder={currentQuestion.type === 'essay' ? 'Write your response clearly and support your answer where appropriate.' : 'Type your answer here.'}
                  className="mipc-input min-h-32 leading-7"
                />
                <p className="mt-2 text-right text-xs text-ink-400">{(answers[currentQuestion.id] || '').length} characters</p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink-900/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((previous) => Math.max(0, previous - 1))}
                className="mipc-button-secondary disabled:pointer-events-none disabled:opacity-40"
              >
                ← Previous
              </button>

              {activeIdx < questions.length - 1 ? (
                <button type="button" onClick={() => setActiveIdx((previous) => Math.min(questions.length - 1, previous + 1))} className="mipc-button-primary">
                  Next question <ChevronRightIcon className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting} className="mipc-button-primary">
                  {submitting ? 'Submitting…' : 'Finish and submit'}
                </button>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
