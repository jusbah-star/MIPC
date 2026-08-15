'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpenIcon } from '@/components/icons';

export type LessonScopeTarget = {
  courseId: string;
  courseLabel: string;
  classSectionId?: string | null;
  scopeLabel: string;
};

export function LessonBuilder({ targets }: { targets: LessonScopeTarget[] }) {
  const router = useRouter();
  const options = useMemo(() => targets.map((target, index) => ({ ...target, key: String(index) })), [targets]);
  const [targetKey, setTargetKey] = useState(options[0]?.key ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekNumber, setWeekNumber] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [published, setPublished] = useState(true);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'success' | 'error'; message?: string }>({ kind: 'idle' });
  const selectedTarget = options.find((item) => item.key === targetKey) ?? options[0];
  const hasTargets = options.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'saving') return;
    if (!selectedTarget) {
      setStatus({ kind: 'error', message: 'A course must be created and assigned before you can add lessons.' });
      return;
    }
    if (title.trim().length < 3) {
      setStatus({ kind: 'error', message: 'Add a clear lesson title.' });
      return;
    }

    setStatus({ kind: 'saving', message: 'Creating lesson…' });
    try {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedTarget.courseId,
          classSectionId: selectedTarget.classSectionId ?? null,
          title: title.trim(),
          description: description.trim(),
          weekNumber: weekNumber || null,
          scheduledDate: scheduledDate || null,
          published
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The lesson could not be created.');

      setTitle('');
      setDescription('');
      setWeekNumber('');
      setScheduledDate('');
      setStatus({ kind: 'success', message: published ? 'Lesson created and visible to students.' : 'Lesson saved as a draft.' });
      router.refresh();
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'The lesson could not be created.' });
    }
  }

  return (
    <form onSubmit={submit} className="mipc-panel grid gap-5 p-6 lg:grid-cols-2" noValidate>
      <div className="lg:col-span-2 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mipc-navy-50 text-mipc-navy-800"><BookOpenIcon className="h-5 w-5" /></span>
        <div>
          <p className="mipc-eyebrow">Lesson planning</p>
          <h2 className="font-display text-xl font-bold text-ink-950">Add lesson / topic</h2>
          <p className="mt-1 text-sm leading-6 text-ink-600">Create the teaching topic first, then attach books, notes, questionnaires, assignments and other resources to it.</p>
        </div>
      </div>

      {!hasTargets && <div className="lg:col-span-2 rounded-xl border border-brass-500/30 bg-brass-400/10 px-4 py-3 text-sm text-ink-700"><strong className="text-ink-950">No course available:</strong> an administrator must create a course/module and it must be assigned to the relevant lecturer, intake or class before lessons can be added.</div>}

      <div className="lg:col-span-2"><label className="mipc-label" htmlFor="lesson-target">Course / audience</label><select id="lesson-target" className="mipc-input" value={targetKey} onChange={(event) => setTargetKey(event.target.value)} disabled={!hasTargets}>{!hasTargets && <option value="">No course assignment available</option>}{options.map((target) => <option key={target.key} value={target.key}>{target.courseLabel} · {target.scopeLabel}</option>)}</select></div>
      <div className="lg:col-span-2"><label className="mipc-label" htmlFor="lesson-title">Lesson title / topic</label><input id="lesson-title" className="mipc-input" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!hasTargets} maxLength={180} placeholder="e.g. Shear force and bending moment diagrams" /></div>
      <div><label className="mipc-label" htmlFor="lesson-week">Week number</label><input id="lesson-week" className="mipc-input" type="number" min="1" max="60" value={weekNumber} onChange={(event) => setWeekNumber(event.target.value)} disabled={!hasTargets} placeholder="e.g. 4" /></div>
      <div><label className="mipc-label" htmlFor="lesson-date">Planned date</label><input id="lesson-date" className="mipc-input" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} disabled={!hasTargets} /></div>
      <div className="lg:col-span-2"><label className="mipc-label" htmlFor="lesson-description">Lesson summary / learning objectives</label><textarea id="lesson-description" className="mipc-input" rows={4} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!hasTargets} placeholder="What students should understand or be able to do after this lesson…" /></div>

      <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-800"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} disabled={!hasTargets} className="h-4 w-4 accent-mipc-green-700" /> Publish lesson to students</label>
        <button type="submit" className="mipc-button-primary" disabled={status.kind === 'saving'}>{status.kind === 'saving' ? 'Creating…' : hasTargets ? 'Add lesson' : 'Why can’t I add a lesson?'}</button>
      </div>
      {status.message && <p className={`lg:col-span-2 rounded-xl px-4 py-3 text-sm ${status.kind === 'error' ? 'bg-signal-danger-bg text-signal-danger' : status.kind === 'success' ? 'bg-signal-ok-bg text-signal-ok' : 'bg-mipc-navy-50 text-ink-700'}`}>{status.message}</p>}
    </form>
  );
}
