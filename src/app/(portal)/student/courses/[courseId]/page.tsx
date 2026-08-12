import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { BookOpenIcon, ChevronRightIcon, ClockIcon, FileTextIcon, MegaphoneIcon } from '@/components/icons';

export default async function StudentCourseRoomPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  let course: any = dataStore.courses.find((item) => item.id === courseId);
  let lecturer: any = dataStore.profiles.find((profile) => profile.id === course?.lecturer_id);
  let tests: any[] = dataStore.tests.filter((test) => test.course_id === course?.id);
  let assignments: any[] = dataStore.assignments.filter((assignment) => assignment.course_id === course?.id);
  let materials: any[] = dataStore.course_materials.filter((item) => item.course_id === course?.id && item.published);
  let announcements: any[] = dataStore.announcements.filter((announcement) => announcement.scope === 'course' || announcement.scope === 'college');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: courseRow, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseError || !courseRow) notFound();
    course = courseRow as any;

    const [testResult, assignmentResult, announcementResult, lecturerResult, materialResult] = await Promise.all([
      supabase.from('tests').select('*').eq('course_id', courseId).eq('published', true).order('available_from'),
      supabase.from('assignments').select('*').eq('course_id', courseId).order('due_date'),
      supabase.from('announcements').select('*').or(`course_id.eq.${courseId},scope.eq.college`).order('published_at', { ascending: false }),
      supabase.from('profiles').select('full_name, email').eq('id', course.lecturer_id).single(),
      supabase.from('course_materials').select('*').eq('course_id', courseId).eq('published', true).order('created_at', { ascending: false })
    ]);
    const error = testResult.error ?? assignmentResult.error ?? announcementResult.error ?? materialResult.error;
    if (error) throw new Error(error.message);
    tests = (testResult.data ?? []) as any;
    assignments = (assignmentResult.data ?? []) as any;
    announcements = (announcementResult.data ?? []) as any;
    lecturer = lecturerResult.data as any;
    materials = (materialResult.data ?? []) as any;
  }

  if (!course) notFound();

  const now = new Date();

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-mipc-green-50 px-3 py-1 text-xs font-semibold text-mipc-green-700">{course.code}</span>
            <span className="text-xs text-ink-400">{course.credits} credits · 2026/2027</span>
          </div>
          <Link href="/student/courses" className="text-sm font-semibold text-ink-500 transition hover:text-mipc-green-700">← All courses</Link>
        </div>

        <h1 className="mt-6 max-w-4xl font-display text-3xl font-extrabold leading-tight tracking-[-0.04em] text-ink-950 sm:text-4xl">{course.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-600">{course.description}</p>

        <div className="mt-7 grid gap-3 border-t border-ink-900/[0.07] pt-6 sm:grid-cols-2">
          <div><p className="text-xs text-ink-400">Lecturer</p><p className="mt-1 text-sm font-semibold text-ink-900">{lecturer?.full_name ?? 'Assigned faculty member'}</p></div>
          <div><p className="text-xs text-ink-400">Contact</p><p className="mt-1 text-sm font-semibold text-mipc-green-700">{lecturer?.email ?? 'Contact the academic registry'}</p></div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs" aria-labelledby="course-materials-title">
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><BookOpenIcon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-mipc-green-700">Learning resources</p><h2 id="course-materials-title" className="mt-0.5 text-lg font-bold">Course materials</h2></div></div>
              <span className="text-xs text-ink-400">{materials.length} published</span>
            </div>
            <div className="mipc-content-list grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              {materials.map((material) => (
                <article key={material.id} className="rounded-2xl border border-ink-900/[0.07] bg-parchment-50 p-4">
                  <p className="text-[11px] font-semibold capitalize text-mipc-green-700">{material.material_type}</p>
                  <h3 className="mt-2 text-sm font-bold text-ink-950">{material.title}</h3>
                  {material.description ? <p className="mt-1 text-xs leading-5 text-ink-500">{material.description}</p> : null}
                  {material.content ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-700">{material.content}</p> : null}
                  {material.resource_url ? <a href={material.resource_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-mipc-green-700">Open resource</a> : null}
                </article>
              ))}
              {materials.length === 0 ? <p className="text-sm text-ink-500 sm:col-span-2">No materials have been published for this course.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><ClockIcon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-mipc-green-700">Assessment</p><h2 className="mt-0.5 text-lg font-bold">Examinations</h2></div></div>
              <span className="text-xs text-ink-400">{tests.length} scheduled</span>
            </div>
            <div className="divide-y divide-ink-900/[0.06]">
              {tests.map((test) => {
                const isOpen = now >= new Date(test.available_from) && now <= new Date(test.available_until);
                return (
                  <div key={test.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div><div className="flex flex-wrap items-center gap-2">{isOpen ? <span className="rounded-full bg-signal-ok-bg px-2.5 py-1 text-[11px] font-semibold text-signal-ok">Open now</span> : <span className="rounded-full bg-parchment-200 px-2.5 py-1 text-[11px] font-semibold text-ink-500">Scheduled</span>}<span className="text-xs text-ink-400">{test.duration_minutes} min · Pass {test.passing_score ?? 50}%</span></div><h3 className="mt-3 text-sm font-bold text-ink-950">{test.title}</h3></div>
                    <Link href={`/student/tests/${test.id}`} className="mipc-button-primary min-h-10 px-4 py-2 text-xs">{isOpen ? 'Open exam' : 'View exam'} <ChevronRightIcon className="h-3.5 w-3.5" /></Link>
                  </div>
                );
              })}
              {tests.length === 0 ? <p className="p-6 text-sm text-ink-500">No exams are currently scheduled for this course.</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/[0.07] p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><FileTextIcon className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-mipc-green-700">Practical work</p><h2 className="mt-0.5 text-lg font-bold">Coursework</h2></div></div>
              <span className="text-xs text-ink-400">{assignments.length} assigned</span>
            </div>
            <div className="divide-y divide-ink-900/[0.06]">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div><p className="text-xs text-ink-400">Due {new Date(assignment.due_date).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })} · {assignment.max_points} points</p><h3 className="mt-2 text-sm font-bold text-ink-950">{assignment.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">{assignment.description}</p></div>
                  <Link href="/student/assignments" className="mipc-button-secondary min-h-10 px-4 py-2 text-xs">Open coursework</Link>
                </div>
              ))}
              {assignments.length === 0 ? <p className="p-6 text-sm text-ink-500">No coursework is assigned for this course.</p> : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs">
            <div className="flex items-center gap-2 border-b border-ink-900/[0.07] p-5"><MegaphoneIcon className="h-4 w-4 text-mipc-green-700" /><h2 className="text-sm font-bold">Course notices</h2></div>
            <div className="divide-y divide-ink-900/[0.06]">
              {announcements.slice(0, 3).map((announcement) => (
                <article key={announcement.id} className="p-5"><time className="text-xs text-ink-400">{new Date(announcement.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}</time><h3 className="mt-2 text-sm font-semibold leading-snug text-ink-950">{announcement.title}</h3><p className="mt-1.5 line-clamp-4 text-xs leading-5 text-ink-500">{announcement.body}</p></article>
              ))}
              {announcements.length === 0 ? <p className="p-5 text-sm text-ink-500">No notices have been published.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl bg-mipc-green-950 p-5 text-white">
            <p className="text-xs font-semibold text-mipc-green-300">Academic support</p>
            <h2 className="mt-2 text-lg font-bold text-white">Need help with this course?</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">Contact {lecturer?.full_name ?? 'your assigned lecturer'} at {lecturer?.email ?? 'the academic registry'} for consultation times and learning support.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
