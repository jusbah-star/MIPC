'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClockIcon,
  CheckCircleIcon,
  ChevronRightIcon
} from '@/components/icons';

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

export default function TestRunner({
  testId,
  testTitle,
  attemptId,
  expiresAt,
  questions,
  initialAnswers
}: Props) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.question_id, a.response ?? '']))
  );
  const answersRef = useRef(answers);
  const dirtyQuestionIdsRef = useRef<Set<string>>(new Set());
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [submitError, setSubmitError] = useState('');
  const submittedRef = useRef(false);

  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  function updateAnswer(questionId: string, response: string) {
    dirtyQuestionIdsRef.current.add(questionId);
    setAnswers((previous) => ({ ...previous, [questionId]: response }));
  }

  const saveDirtyAnswers = useCallback(async () => {
    if (submittedRef.current || dirtyQuestionIdsRef.current.size === 0) return;
    if (savePromiseRef.current) return savePromiseRef.current;

    const dirtyIds = Array.from(dirtyQuestionIdsRef.current);
    const payload = dirtyIds.map((questionId) => ({
      questionId,
      response: answersRef.current[questionId] ?? ''
    }));

    const savePromise = (async () => {
      setSaveStatus('saving');
      try {
        const response = await fetch(`/api/tests/${testId}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: payload })
        });
        if (!response.ok) throw new Error('Save failed');

        // Only mark a question clean if it has not changed again while the
        // network request was running. Newer edits stay dirty for the next save.
        for (const item of payload) {
          if ((answersRef.current[item.questionId] ?? '') === item.response) {
            dirtyQuestionIdsRef.current.delete(item.questionId);
          }
        }
        setSubmitError('');
      } catch {
        setSubmitError('Autosave is temporarily unavailable. Your answers remain on this page and MIPC will retry.');
      } finally {
        setSaveStatus('saved');
      }
    })();

    savePromiseRef.current = savePromise;
    try {
      await savePromise;
    } finally {
      savePromiseRef.current = null;
    }
  }, [testId]);

  // Synchronized countdown timer.
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0 && !submittedRef.current) {
        clearInterval(interval);
        void handleSubmit();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  // Save only answers changed since the previous successful sync. A 15-second
  // cadence smooths examination-room bursts while final submission still sends
  // the complete answer set atomically.
  useEffect(() => {
    const interval = setInterval(() => {
      void saveDirtyAnswers();
    }, 15_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void saveDirtyAnswers();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveDirtyAnswers, attemptId]);

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      // Avoid making the final-submit transaction wait behind an autosave from
      // this same attempt. The final payload still contains every current answer.
      if (savePromiseRef.current) await savePromiseRef.current;

      const response = await fetch(`/api/tests/${testId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: Object.entries(answersRef.current).map(([questionId, response]) => ({ questionId, response }))
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

  const minutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));
  const isUrgent = remainingMs < 120_000;
  const answeredCount = Object.values(answers).filter((v) => v && v.trim().length > 0).length;
  const currentQ = questions[activeIdx];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {submitError && (
        <div role="alert" className="rounded-xl border border-signal-danger/30 bg-signal-danger-bg px-4 py-3 text-sm text-signal-danger">
          {submitError}
        </div>
      )}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md border border-ink-900/10 rounded-2xl p-4 sm:p-5 shadow-academic flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ink-900 text-brass-400 flex items-center justify-center font-bold">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink-950 leading-tight">{testTitle}</h1>
            <div className="flex items-center gap-3 text-xs text-ink-600 font-mono mt-0.5">
              <span>{answeredCount} of {questions.length} answered</span>
              <span>·</span>
              <span className="text-signal-ok font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-ok" />
                {saveStatus === 'saving' ? 'Syncing…' : dirtyQuestionIdsRef.current.size ? 'Pending sync' : 'Autosaved'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl font-mono text-xl font-bold tracking-wider tabular-nums flex items-center gap-2 border ${isUrgent ? 'bg-signal-danger-bg text-signal-danger border-signal-danger/30 animate-pulse' : 'bg-parchment-100 text-ink-950 border-parchment-300'}`}>
            <ClockIcon className="w-4 h-4" />
            <span>{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2">
            {submitting ? 'Recording Final Grade…' : 'Final Submit'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-ink-900/10 p-5 shadow-xs">
            <h3 className="font-mono text-xs uppercase tracking-wider font-bold text-ink-700 mb-3">Questions Matrix</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id] && answers[q.id].trim().length > 0);
                const isCurrent = activeIdx === idx;
                return (
                  <button key={q.id} onClick={() => setActiveIdx(idx)} className={`h-9 rounded-lg font-mono text-xs font-bold transition-all ${isCurrent ? 'bg-ink-900 text-white ring-2 ring-brass-500 ring-offset-2' : isAnswered ? 'bg-signal-ok-bg text-signal-ok border border-signal-ok/30' : 'bg-parchment-100 text-ink-700 hover:bg-parchment-200'}`}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-parchment-200 space-y-2 text-[11px] font-mono text-ink-600">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-signal-ok-bg border border-signal-ok/30" /><span>Answered</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-parchment-100" /><span>Unanswered</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-ink-900" /><span>Active</span></div>
            </div>
          </div>
        </div>

        {currentQ && (
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl border border-ink-900/10 p-6 sm:p-8 shadow-academic">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-parchment-200">
                <span className="text-xs font-mono uppercase tracking-wider text-brass-700 font-bold bg-brass-400/15 px-2.5 py-1 rounded">Question {activeIdx + 1} of {questions.length} · {currentQ.points} Point{currentQ.points === 1 ? '' : 's'}</span>
                <span className="text-xs font-mono text-ink-500 uppercase">Format: {currentQ.type.replace('_', ' ')}</span>
              </div>

              <h2 className="font-display text-xl font-bold text-ink-950 mb-6 leading-relaxed">{currentQ.prompt}</h2>

              {currentQ.type === 'mcq' && currentQ.options && (
                <div className="space-y-3">
                  {currentQ.options.map((opt) => {
                    const isSelected = answers[currentQ.id] === opt.id;
                    return (
                      <label key={opt.id} onClick={() => updateAnswer(currentQ.id, opt.id)} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-parchment-100/80 border-brass-500 shadow-xs' : 'bg-white border-parchment-300 hover:bg-parchment-50'}`}>
                        <input type="radio" name={currentQ.id} checked={isSelected} onChange={() => {}} className="mt-1 text-brass-600 focus:ring-brass-500" />
                        <span className="text-sm font-medium text-ink-900 leading-snug">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {(currentQ.type === 'short_answer' || currentQ.type === 'essay') && (
                <div className="space-y-2">
                  <textarea value={answers[currentQ.id] ?? ''} onChange={(e) => updateAnswer(currentQ.id, e.target.value)} rows={currentQ.type === 'essay' ? 8 : 3} placeholder="Type your scholarly response..." className="w-full rounded-xl border border-ink-900/15 p-4 text-sm text-ink-950 placeholder:text-ink-400 outline-none focus-visible:border-brass-500 bg-parchment-50/50 leading-relaxed font-sans" />
                  <div className="flex justify-end text-xs font-mono text-ink-500">{(answers[currentQ.id] || '').length} characters</div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-parchment-200 flex items-center justify-between">
                <button type="button" disabled={activeIdx === 0} onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))} className="rounded-lg border border-parchment-300 bg-white px-4 py-2 text-xs font-mono font-medium text-ink-800 hover:bg-parchment-100 disabled:opacity-40">&larr; Previous Question</button>
                <div className="flex items-center gap-2">
                  {activeIdx < questions.length - 1 ? (
                    <button type="button" onClick={() => setActiveIdx((prev) => Math.min(questions.length - 1, prev + 1))} className="rounded-lg bg-ink-900 px-5 py-2 text-xs font-medium text-white hover:bg-ink-800 flex items-center gap-1.5"><span>Next Question</span><ChevronRightIcon className="w-3.5 h-3.5 text-brass-400" /></button>
                  ) : (
                    <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-brass-500 px-6 py-2 text-xs font-bold text-ink-950 hover:bg-brass-400 shadow-sm">Finish & Submit</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
