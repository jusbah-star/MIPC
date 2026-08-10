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
    } else profiles = [];
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mipc-eyebrow">Assessment records</p>
        <h1 className="mipc-page-title">Coursework grading</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-700">Review submissions and record marks within the approved maximum. Every change is written to the audit trail.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        {submissions.map((submission) => {
          const assignment = assignments.find((item) => item.id === submission.assignment_id);
          const student = profiles.find((item) => item.id === submission.student_id);
          if (!assignment) return null;
          return (
            <article key={submission.id} className="mipc-panel overflow-hidden">
              <div className="border-b border-parchment-200 bg-parchment-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{assignment.title}</p>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink-950">{student?.full_name ?? 'Student'}</h2>
                    <p className="text-xs text-ink-600">Submitted {new Date(submission.submitted_at).toLocaleString('en-RW')}</p>
                  </div>
                  <span className="mipc-status">{submission.grade === null ? 'Awaiting review' : `${submission.grade}/${assignment.max_points}`}</span>
                </div>
              </div>
              <div className="space-y-5 p-5">
                <section aria-label="Student submission">
                  <h3 className="mipc-label flex items-center gap-2"><FileTextIcon className="h-4 w-4" /> Student response</h3>
                  <div className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-parchment-200 bg-white p-4 text-sm leading-6 text-ink-800">
                    {submission.content || (submission.file_path ? `Submitted file: ${submission.file_path}` : 'No response text available.')}
                  </div>
                </section>
                <form action={recordGrade} className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <input type="hidden" name="submission_id" value={submission.id} />
                  <div>
                    <label className="mipc-label" htmlFor={`grade-${submission.id}`}>Mark (max {assignment.max_points})</label>
                    <input id={`grade-${submission.id}`} name="grade" type="number" min="0" max={assignment.max_points} step="0.5" required defaultValue={submission.grade ?? ''} className="mipc-input" />
                  </div>
                  <div>
                    <label className="mipc-label" htmlFor={`feedback-${submission.id}`}>Feedback</label>
                    <textarea id={`feedback-${submission.id}`} name="feedback" rows={3} maxLength={5000} defaultValue={submission.feedback ?? ''} className="mipc-input" />
                  </div>
                  <button type="submit" className="mipc-button-primary sm:col-span-2 sm:justify-self-end"><CheckCircleIcon className="h-4 w-4" /> Record mark</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
      {submissions.length === 0 && <div className="mipc-empty">There are no coursework submissions waiting for review.</div>}
    </div>
  );
}
