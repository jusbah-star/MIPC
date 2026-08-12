import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { CheckCircleIcon, ClockIcon, FileTextIcon } from '@/components/icons';
import { submitCoursework } from './actions';

export default async function StudentAssignmentsPage() {
  let assignments: any[] = [];
  let submissions: any[] = [];
  let courses: any[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const enrollments: any[] = (await supabase.from('enrollments').select('course_id').eq('student_id', user.id).eq('status', 'active')).data ?? [];
      const ids = enrollments.map((item) => item.course_id);
      if (ids.length) {
        const [assignmentResult, courseResult] = await Promise.all([
          supabase.from('assignments').select('*').in('course_id', ids).order('due_date'),
          supabase.from('courses').select('id, code, title').in('id', ids)
        ]);
        assignments = assignmentResult.data ?? [];
        courses = courseResult.data ?? [];
      }
      submissions = (await supabase.from('submissions').select('id, assignment_id, submitted_at, grade, feedback').eq('student_id', user.id)).data ?? [];
    }
  } else {
    const student = dataStore.currentUser?.role === 'student' ? dataStore.currentUser : dataStore.profiles.find((item) => item.role === 'student');
    const ids = dataStore.enrollments.filter((item) => item.student_id === student?.id && item.status === 'active').map((item) => item.course_id);
    assignments = dataStore.assignments.filter((item) => ids.includes(item.course_id));
    submissions = dataStore.submissions.filter((item) => item.student_id === student?.id);
    courses = dataStore.courses.filter((item) => ids.includes(item.id));
  }

  const byAssignment = new Map(submissions.map((item) => [item.assignment_id, item]));
  const submittedCount = assignments.filter((assignment) => byAssignment.has(assignment.id)).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Coursework</p>
          <h1 className="mipc-page-title">Assignments & practical work</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Review briefs, submit written work or approved repository links, and see grading status in one place.</p>
        </div>
        <span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-xs font-semibold text-mipc-green-700">{submittedCount} of {assignments.length} submitted</span>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {assignments.map((assignment) => {
          const course = courses.find((item) => item.id === assignment.course_id);
          const submission = byAssignment.get(assignment.id);
          const due = new Date(assignment.due_date);
          const isLate = !submission && due.getTime() < Date.now();

          return (
            <article key={assignment.id} className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course?.code ?? 'Course'}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isLate ? 'text-signal-danger' : 'text-ink-500'}`}><ClockIcon className="h-3.5 w-3.5" /> Due {due.toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <h2 className="mt-4 text-xl font-bold leading-snug tracking-[-0.025em] text-ink-950">{assignment.title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">{assignment.description}</p>

                {submission ? (
                  <div className="mt-5 rounded-2xl bg-signal-ok-bg p-4 text-sm text-signal-ok">
                    <div className="flex items-start gap-2.5"><CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Submitted {new Date(submission.submitted_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}</p><p className="mt-1 text-xs leading-5 opacity-80">{submission.grade != null ? `Grade: ${submission.grade}/${assignment.max_points}${submission.feedback ? ` · ${submission.feedback}` : ''}` : 'Awaiting faculty review'}</p></div></div>
                  </div>
                ) : null}
              </div>

              <form action={submitCoursework} className="grid gap-3 border-t border-ink-900/[0.07] bg-parchment-50 p-5 sm:p-6">
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <label className="mipc-label" htmlFor={`content-${assignment.id}`}>{submission ? 'Replace submission' : 'Your submission'}</label>
                <textarea id={`content-${assignment.id}`} name="content" className="mipc-field min-h-32 text-sm leading-6" maxLength={20000} required placeholder="Write your response or paste the approved repository/resource link." />
                <div className="flex items-center justify-between gap-3"><p className="text-xs text-ink-400">Maximum 20,000 characters</p><button className="mipc-button-primary"><FileTextIcon className="h-4 w-4" /> {submission ? 'Resubmit' : 'Submit work'}</button></div>
              </form>
            </article>
          );
        })}
        {!assignments.length ? <div className="mipc-empty lg:col-span-2">No coursework is currently assigned.</div> : null}
      </div>
    </div>
  );
}
