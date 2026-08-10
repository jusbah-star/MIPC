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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mipc-eyebrow">Assessment register</p><h1 className="mipc-page-title">Examinations and quizzes</h1><p className="mt-2 text-sm text-ink-700">Review assessment windows and publication status for your courses.</p></div>
        <Link href="/lecturer/tests/new" className="mipc-button-primary"><PlusIcon className="h-4 w-4" /> New assessment</Link>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {tests.map((test) => {
          const course = courses.find((item) => item.id === test.course_id);
          return <article key={test.id} className="mipc-panel p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-mipc-green-700">{course?.code ?? 'MIPC course'}</p><h2 className="mt-1 font-display text-xl font-bold text-ink-950">{test.title}</h2></div><span className="mipc-status">{test.published ? 'Published' : 'Draft'}</span></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-parchment-200 pt-4 text-xs text-ink-600"><span><ClockIcon className="mb-1 h-4 w-4 text-brass-600" />{test.duration_minutes} minutes</span><span><strong className="block text-ink-950">{test.passing_score}%</strong>Pass mark</span><span><strong className="block text-ink-950">{new Date(test.available_until).toLocaleDateString('en-RW')}</strong>Closes</span></div></article>;
        })}
      </div>
      {tests.length === 0 && <div className="mipc-empty">No assessments have been created yet.</div>}
    </div>
  );
}
