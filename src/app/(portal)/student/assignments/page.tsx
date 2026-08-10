import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { CheckCircleIcon, ClockIcon, FileTextIcon } from '@/components/icons';
import { submitCoursework } from './actions';

export default async function StudentAssignmentsPage() {
  let assignments: any[] = [], submissions: any[] = [], courses: any[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const enrollments: any[] = (await supabase.from('enrollments').select('course_id').eq('student_id', user.id).eq('status', 'active')).data ?? [];
      const ids = enrollments.map((item) => item.course_id);
      if (ids.length) {
        const [a, c] = await Promise.all([supabase.from('assignments').select('*').in('course_id', ids).order('due_date'), supabase.from('courses').select('id, code, title').in('id', ids)]);
        assignments = a.data ?? []; courses = c.data ?? [];
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
  return <div className="space-y-8">
    <div><p className="mipc-eyebrow">Coursework studio</p><h1 className="mt-2 text-4xl font-bold">Assignments & practical work</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-700">Submit written solutions or repository links. Every submission is recorded against your authenticated student account.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">{assignments.map((assignment) => {
      const course = courses.find((item) => item.id === assignment.course_id); const submission = byAssignment.get(assignment.id);
      return <article key={assignment.id} className="mipc-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-mipc-green-100 px-3 py-1 text-xs font-bold text-mipc-green-800">{course?.code ?? 'MODULE'}</span><span className="flex items-center gap-1.5 text-xs text-ink-600"><ClockIcon className="h-4 w-4" />Due {new Date(assignment.due_date).toLocaleDateString('en-RW', { dateStyle: 'medium' })}</span></div><h2 className="mt-5 text-2xl font-bold">{assignment.title}</h2><p className="mt-2 text-sm leading-6 text-ink-700">{assignment.description}</p>{submission && <div className="mt-5 flex items-start gap-2 rounded-xl bg-signal-ok-bg p-3 text-sm text-signal-ok"><CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /><span>Submitted {new Date(submission.submitted_at).toLocaleDateString('en-RW')}{submission.grade != null ? ` · Grade ${submission.grade}/${assignment.max_points}` : ' · Awaiting faculty review'}</span></div>}<form action={submitCoursework} className="mt-6 grid gap-3 border-t border-ink-900/10 pt-5"><input type="hidden" name="assignmentId" value={assignment.id} /><label className="mipc-label" htmlFor={`content-${assignment.id}`}>{submission ? 'Replace submission' : 'Your submission'}</label><textarea id={`content-${assignment.id}`} name="content" className="mipc-field min-h-32 font-mono text-xs" maxLength={20000} required placeholder="Paste your response or repository link…" /><button className="mipc-button-primary justify-self-start"><FileTextIcon className="h-4 w-4" />{submission ? 'Resubmit work' : 'Submit work'}</button></form></article>;
    })}{!assignments.length && <div className="mipc-card col-span-full p-12 text-center text-ink-600">No coursework is currently assigned.</div>}</div>
  </div>;
}
