import Link from 'next/link';
import { ClockIcon, PlusIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';

export default async function LecturerTestsPage() {
  let tests: any[] = dataStore.tests;
  let courses: any[] = dataStore.courses;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Lecturer authentication required.');

    const [{ data: testRows, error: testError }, { data: courseRows, error: courseError }] = await Promise.all([
      supabase.from('tests').select('*').eq('lecturer_id', user.id).order('available_from', { ascending: false }),
      supabase.from('courses').select('*').eq('lecturer_id', user.id)
    ]);
    if (testError || courseError) throw new Error(testError?.message ?? courseError?.message);
    tests = (testRows ?? []) as any;
    courses = (courseRows ?? []) as any;
  }

  const publishedCount = tests.filter((test) => test.published).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="mipc-eyebrow">Assessments</p>
          <h1 className="mipc-page-title">Assessment register</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Review assessment windows, duration, pass marks and publication state across your courses.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="rounded-full bg-mipc-green-50 px-3 py-1.5 text-xs font-semibold text-mipc-green-700">{publishedCount} published</span>
          <Link href="/lecturer/tests/new" className="mipc-button-primary"><PlusIcon className="h-4 w-4" /> New assessment</Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {tests.map((test) => {
          const course = courses.find((item) => item.id === test.course_id);
          const opens = new Date(test.available_from);
          const closes = new Date(test.available_until);
          const now = new Date();
          const isOpen = test.published && now >= opens && now <= closes;

          return (
            <article key={test.id} className="rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs transition hover:border-mipc-green-700/20 hover:shadow-academic sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold text-mipc-green-700">{course?.code ?? 'MIPC course'}</span>
                    {isOpen ? <span className="rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok">Open now</span> : null}
                  </div>
                  <h2 className="mt-4 text-xl font-bold leading-snug tracking-[-0.025em] text-ink-950">{test.title}</h2>
                  <p className="mt-1 text-xs text-ink-400">{course?.title ?? 'Academic course'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${test.published ? 'bg-signal-ok-bg text-signal-ok' : 'bg-parchment-200 text-ink-500'}`}>{test.published ? 'Published' : 'Draft'}</span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-ink-900/[0.07] pt-5 text-xs text-ink-500">
                <div><ClockIcon className="mb-2 h-4 w-4 text-mipc-green-700" /><strong className="block text-sm font-semibold text-ink-900">{test.duration_minutes} min</strong><span>Duration</span></div>
                <div><strong className="block text-sm font-semibold text-ink-900">{test.passing_score}%</strong><span className="mt-1 block">Pass mark</span></div>
                <div><strong className="block text-sm font-semibold text-ink-900">{closes.toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}</strong><span className="mt-1 block">Closes</span></div>
              </div>
            </article>
          );
        })}
      </div>

      {tests.length === 0 ? <div className="mipc-empty">No assessments have been created yet.</div> : null}
    </div>
  );
}
