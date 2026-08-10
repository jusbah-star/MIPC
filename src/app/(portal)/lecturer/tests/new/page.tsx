import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClockIcon, ShieldCheckIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createCompleteTest } from './actions';

function dateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function NewTestBuilderPage() {
  let courses = dataStore.courses;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { data, error } = await supabase.from('courses').select('*').eq('lecturer_id', user.id).order('code');
    if (error) throw new Error(error.message);
    courses = data ?? [];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mipc-eyebrow">Faculty assessment design</p>
          <h1 className="mipc-page-title">Create a secure assessment</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-700">Answer keys remain on the server. Essays are held for manual review before a final mark is released.</p>
        </div>
        <Link href="/lecturer/tests" className="mipc-button-secondary">Back to assessments</Link>
      </header>

      <form action={createCompleteTest} className="space-y-6">
        <section className="mipc-panel space-y-5 p-6 sm:p-8" aria-labelledby="assessment-settings">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-mipc-green-100 p-2 text-mipc-green-800"><ClockIcon className="h-5 w-5" /></span><h2 id="assessment-settings" className="font-display text-xl font-bold text-ink-950">Assessment settings</h2></div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Course" id="course_id"><select className="mipc-input" id="course_id" name="course_id" required><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></Field>
            <Field label="Assessment title" id="title"><input className="mipc-input" id="title" name="title" required minLength={4} maxLength={200} /></Field>
            <div className="md:col-span-2"><Field label="Instructions" id="description"><textarea className="mipc-input" id="description" name="description" rows={3} maxLength={2000} /></Field></div>
            <Field label="Duration (minutes)" id="duration_minutes"><input className="mipc-input" id="duration_minutes" name="duration_minutes" type="number" min="5" max="300" defaultValue="45" required /></Field>
            <Field label="Pass mark (%)" id="passing_score"><input className="mipc-input" id="passing_score" name="passing_score" type="number" min="0" max="100" step="0.5" defaultValue="50" required /></Field>
            <Field label="Opens" id="available_from"><input className="mipc-input" id="available_from" name="available_from" type="datetime-local" defaultValue={dateInput(new Date())} required /></Field>
            <Field label="Closes" id="available_until"><input className="mipc-input" id="available_until" name="available_until" type="datetime-local" defaultValue={dateInput(new Date(Date.now() + 14 * 86_400_000))} required /></Field>
          </div>
        </section>

        <QuestionCard number={1} type="mcq" title="Multiple-choice question" required />
        <QuestionCard number={2} type="short_answer" title="Short-answer question (optional)" />
        <QuestionCard number={3} type="essay" title="Essay question (optional)" />

        <section className="mipc-panel flex flex-wrap items-center justify-between gap-4 p-5">
          <label className="flex items-start gap-3 text-sm text-ink-800"><input className="mt-1 h-4 w-4 accent-mipc-green-700" type="checkbox" name="published" /><span><strong className="block text-ink-950">Publish immediately</strong>Students can access it only during the opening window.</span></label>
          <button className="mipc-button-primary" type="submit" disabled={courses.length === 0}><ShieldCheckIcon className="h-4 w-4" /> Save assessment</button>
        </section>
      </form>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label className="mipc-label" htmlFor={id}>{label}</label>{children}</div>;
}

function QuestionCard({ number, type, title, required = false }: { number: number; type: 'mcq' | 'short_answer' | 'essay'; title: string; required?: boolean }) {
  return (
    <section className="mipc-panel space-y-5 p-6 sm:p-8" aria-labelledby={`question-title-${number}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`question-title-${number}`} className="font-display text-xl font-bold text-ink-950">{number}. {title}</h2>
        <div className="w-28"><Field label="Points" id={`question_${number}_points`}><input className="mipc-input" id={`question_${number}_points`} name={`question_${number}_points`} type="number" min="1" max="1000" defaultValue={type === 'essay' ? 20 : 5} required={required} /></Field></div>
      </div>
      <input type="hidden" name={`question_${number}_type`} value={type} />
      <Field label="Question prompt" id={`question_${number}_prompt`}><textarea className="mipc-input" id={`question_${number}_prompt`} name={`question_${number}_prompt`} rows={3} minLength={3} maxLength={10000} required={required} /></Field>
      {type === 'mcq' && <div className="grid gap-4 sm:grid-cols-2">{(['a', 'b', 'c', 'd'] as const).map((option) => <Field key={option} label={`Option ${option.toUpperCase()}`} id={`question_${number}_option_${option}`}><input className="mipc-input" id={`question_${number}_option_${option}`} name={`question_${number}_option_${option}`} required /></Field>)}<div className="sm:col-span-2"><Field label="Correct option" id={`question_${number}_answer`}><select className="mipc-input" id={`question_${number}_answer`} name={`question_${number}_answer`} required><option value="">Select the answer key</option>{['a', 'b', 'c', 'd'].map((option) => <option key={option} value={option}>Option {option.toUpperCase()}</option>)}</select></Field></div></div>}
      {type === 'short_answer' && <Field label="Expected answer" id={`question_${number}_answer`}><textarea className="mipc-input" id={`question_${number}_answer`} name={`question_${number}_answer`} rows={2} maxLength={10000} /></Field>}
      {type === 'essay' && <p className="rounded-xl border border-brass-400/40 bg-brass-50 p-4 text-sm text-ink-700">Essay responses always require faculty review; no answer key is exposed or auto-scored.</p>}
    </section>
  );
}
