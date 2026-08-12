import { redirect } from 'next/navigation';
import { CheckCircleIcon, FileTextIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { recordGrade } from './actions';

export default async function LecturerGradingPage() {
  let submissions = dataStore.submissions;
  let assignments = dataStore.assignments;
  let profiles = dataStore.profiles;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [{ data: submissionRows, error: submissionError }, { data: assignmentRows, error: assignmentError }] = await Promise.all([
      supabase.from('submissions').select('*').order('submitted_at', { ascending: false }),
      supabase.from('assignments').select('*')
    ]);
    if (submissionError || assignmentError) throw new Error(submissionError?.message ?? assignmentError?.message);

    submissions = submissionRows ?? [];
    assignments = assignmentRows ?? [];
    const studentIds = Array.from(new Set(submissions.map((item) => item.student_id)));
    if (studentIds.length) {
      const { data: studentRows, error } = await supabase.from('profiles').select('*').in('id', studentIds);
      if (error) throw new Error(error.message);
      profiles = studentRows ?? [];
    } else {
      profiles = [];
    }
  }

  const pendingCount = submissions.filter((submission) => submission.grade === null).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Grading centre</p>
          <h1 className="mipc-page-title">Coursework review</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Read student submissions, record a mark within the assignment maximum, and leave useful feedback.</p>
        </div>
        <span className="rounded-full bg-signal-warn-bg px-3 py-1.5 text-xs font-semibold text-signal-warn">{pendingCount} awaiting review</span>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        {submissions.map((submission) => {
          const assignment = assignments.find((item) => item.id === submission.assignment_id);
          const student = profiles.find((item) => item.id === submission.student_id);
          if (!assignment) return null;

          return (
            <article key={submission.id} className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-900/[0.07] bg-parchment-50 p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold text-mipc-green-700">{assignment.title}</p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-ink-950">{student?.full_name ?? 'Student'}</h2>
                  <p className="mt-1 text-xs text-ink-400">Submitted {new Date(submission.submitted_at).toLocaleString('en-RW')}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${submission.grade === null ? 'bg-signal-warn-bg text-signal-warn' : 'bg-signal-ok-bg text-signal-ok'}`}>
                  {submission.grade === null ? 'Awaiting review' : `${submission.grade}/${assignment.max_points}`}
                </span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <section aria-label="Student submission">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500"><FileTextIcon className="h-4 w-4 text-mipc-green-700" /> Student response</div>
                  <div className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-ink-900/[0.07] bg-parchment-50 p-4 text-sm leading-7 text-ink-700">
                    {submission.content || (submission.file_path ? `Submitted file: ${submission.file_path}` : 'No response text available.')}
                  </div>
                </section>

                <form action={recordGrade} className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <input type="hidden" name="submission_id" value={submission.id} />
                  <div>
                    <label className="mipc-label" htmlFor={`grade-${submission.id}`}>Mark <span className="font-normal text-ink-400">/ {assignment.max_points}</span></label>
                    <input id={`grade-${submission.id}`} name="grade" type="number" min="0" max={assignment.max_points} step="0.5" required defaultValue={submission.grade ?? ''} className="mipc-input" />
                  </div>
                  <div>
                    <label className="mipc-label" htmlFor={`feedback-${submission.id}`}>Feedback</label>
                    <textarea id={`feedback-${submission.id}`} name="feedback" rows={3} maxLength={5000} defaultValue={submission.feedback ?? ''} className="mipc-input" placeholder="Give concise, constructive feedback." />
                  </div>
                  <button type="submit" className="mipc-button-primary sm:col-span-2 sm:justify-self-end"><CheckCircleIcon className="h-4 w-4" /> Save grade</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {submissions.length === 0 ? <div className="mipc-empty">There are no coursework submissions waiting for review.</div> : null}
    </div>
  );
}
