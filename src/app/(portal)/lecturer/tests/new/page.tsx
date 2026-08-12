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
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Assessment builder</p>
          <h1 className="mipc-page-title">Create an assessment</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Set the assessment window and scoring, then add questions. Answer keys stay server-side and essay responses remain available for lecturer review.</p>
        </div>
        <Link href="/lecturer/tests" className="mipc-button-secondary">Back to assessments</Link>
      </header>

      <form action={createCompleteTest} className="space-y-5">
        <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8" aria-labelledby="assessment-settings">
          <div className="flex items-center gap-3 border-b border-ink-900/[0.07] pb-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><ClockIcon className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold text-mipc-green-700">Step 1</p>
              <h2 id="assessment-settings" className="mt-0.5 text-xl font-bold tracking-[-0.02em]">Assessment details</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Course" id="course_id">
              <select className="mipc-input" id="course_id" name="course_id" required>
                <option value="">Select a course</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
              </select>
            </Field>
            <Field label="Assessment title" id="title">
              <input className="mipc-input" id="title" name="title" required minLength={4} maxLength={200} placeholder="e.g. Mid-semester assessment" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Student instructions" id="description">
                <textarea className="mipc-input" id="description" name="description" rows={3} maxLength={2000} placeholder="Add any instructions students should read before starting." />
              </Field>
            </div>
            <Field label="Duration" id="duration_minutes" hint="Minutes">
              <input className="mipc-input" id="duration_minutes" name="duration_minutes" type="number" min="5" max="300" defaultValue="45" required />
            </Field>
            <Field label="Pass mark" id="passing_score" hint="Percentage">
              <input className="mipc-input" id="passing_score" name="passing_score" type="number" min="0" max="100" step="0.5" defaultValue="50" required />
            </Field>
            <Field label="Opens" id="available_from">
              <input className="mipc-input" id="available_from" name="available_from" type="datetime-local" defaultValue={dateInput(new Date())} required />
            </Field>
            <Field label="Closes" id="available_until">
              <input className="mipc-input" id="available_until" name="available_until" type="datetime-local" defaultValue={dateInput(new Date(Date.now() + 14 * 86_400_000))} required />
            </Field>
          </div>
        </section>

        <div className="pt-2">
          <p className="text-xs font-semibold text-mipc-green-700">Step 2</p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em]">Questions</h2>
          <p className="mt-2 text-sm text-ink-500">The first multiple-choice question is required. Additional short-answer and essay questions are optional.</p>
        </div>

        <QuestionCard number={1} type="mcq" title="Multiple choice" required />
        <QuestionCard number={2} type="short_answer" title="Short answer" />
        <QuestionCard number={3} type="essay" title="Essay" />

        <section className="sticky bottom-4 z-10 flex flex-col gap-4 rounded-2xl border border-ink-900/[0.09] bg-white/95 p-4 shadow-academic-lg backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-3 text-sm text-ink-600">
            <input className="mt-1 h-4 w-4 shrink-0 accent-mipc-green-700" type="checkbox" name="published" />
            <span><strong className="block font-semibold text-ink-950">Publish immediately</strong><span className="mt-0.5 block text-xs">Students only see it during the opening window.</span></span>
          </label>
          <button className="mipc-button-primary min-w-44" type="submit" disabled={courses.length === 0}>
            <ShieldCheckIcon className="h-4 w-4" /> Save assessment
          </button>
        </section>
      </form>
    </div>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-ink-800" htmlFor={id}>{label}</label>
        {hint ? <span className="text-xs text-ink-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function QuestionCard({ number, type, title, required = false }: { number: number; type: 'mcq' | 'short_answer' | 'essay'; title: string; required?: boolean }) {
  const isOptional = !required;

  return (
    <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-xs sm:p-8" aria-labelledby={`question-title-${number}`}>
      <div className="flex flex-col gap-4 border-b border-ink-900/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-parchment-100 text-sm font-bold text-ink-700">{number}</span>
          <div>
            <h2 id={`question-title-${number}`} className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
            <p className="mt-0.5 text-xs text-ink-400">{isOptional ? 'Optional question' : 'Required question'}</p>
          </div>
        </div>
        <div className="w-full sm:w-28">
          <Field label="Points" id={`question_${number}_points`}>
            <input className="mipc-input" id={`question_${number}_points`} name={`question_${number}_points`} type="number" min="1" max="1000" defaultValue={type === 'essay' ? 20 : 5} required={required} />
          </Field>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <input type="hidden" name={`question_${number}_type`} value={type} />
        <Field label="Question" id={`question_${number}_prompt`}>
          <textarea className="mipc-input" id={`question_${number}_prompt`} name={`question_${number}_prompt`} rows={3} minLength={3} maxLength={10000} required={required} placeholder="Write the question exactly as students should see it." />
        </Field>

        {type === 'mcq' ? (
          <div className="rounded-2xl bg-parchment-50 p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold text-ink-500">Answer options</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['a', 'b', 'c', 'd'] as const).map((option) => (
                <Field key={option} label={`Option ${option.toUpperCase()}`} id={`question_${number}_option_${option}`}>
                  <input className="mipc-input" id={`question_${number}_option_${option}`} name={`question_${number}_option_${option}`} required />
                </Field>
              ))}
              <div className="sm:col-span-2">
                <Field label="Correct answer" id={`question_${number}_answer`}>
                  <select className="mipc-input" id={`question_${number}_answer`} name={`question_${number}_answer`} required>
                    <option value="">Select the correct option</option>
                    {['a', 'b', 'c', 'd'].map((option) => <option key={option} value={option}>Option {option.toUpperCase()}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </div>
        ) : null}

        {type === 'short_answer' ? (
          <Field label="Expected answer" id={`question_${number}_answer`}>
            <textarea className="mipc-input" id={`question_${number}_answer`} name={`question_${number}_answer`} rows={2} maxLength={10000} placeholder="Enter the expected answer used for marking." />
          </Field>
        ) : null}

        {type === 'essay' ? (
          <div className="rounded-2xl border border-mipc-green-700/10 bg-mipc-green-50 p-4 text-sm leading-6 text-ink-600">
            Essay responses are never auto-scored. They stay in the faculty grading workflow for manual review.
          </div>
        ) : null}
      </div>
    </section>
  );
}
