import { redirect } from 'next/navigation';
import { MegaphoneIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { publishCourseAnnouncement } from './actions';

export default async function LecturerAnnouncementsPage() {
  let courses = dataStore.courses;
  let announcements = dataStore.announcements;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [{ data: courseRows, error: courseError }, { data: announcementRows, error: announcementError }] = await Promise.all([
      supabase.from('courses').select('*').eq('lecturer_id', user.id).order('code'),
      supabase.from('announcements').select('*').eq('author_id', user.id).order('published_at', { ascending: false }).limit(8)
    ]);
    if (courseError || announcementError) throw new Error(courseError?.message ?? announcementError?.message);
    courses = courseRows ?? [];
    announcements = announcementRows ?? [];
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="mipc-eyebrow">Course communication</p>
        <h1 className="mipc-page-title">Publish a bulletin</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Send an official notice to students enrolled in one of your assigned courses.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <form action={publishCourseAnnouncement} className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8">
          <div className="flex items-center gap-3 border-b border-ink-900/[0.07] pb-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><MegaphoneIcon className="h-5 w-5" /></span>
            <div><p className="text-xs font-semibold text-mipc-green-700">New bulletin</p><h2 className="mt-0.5 text-lg font-bold">Compose message</h2></div>
          </div>
          <div className="mt-6 grid gap-5">
            <div><label className="mipc-label" htmlFor="course_id">Course</label><select id="course_id" name="course_id" required className="mipc-input"><option value="">Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}</select></div>
            <div><label className="mipc-label" htmlFor="title">Headline</label><input id="title" name="title" required minLength={4} maxLength={180} className="mipc-input" placeholder="What students need to know" /></div>
            <div><label className="mipc-label" htmlFor="body">Message</label><textarea id="body" name="body" required minLength={10} maxLength={5000} rows={9} className="mipc-input" placeholder="Include the relevant dates, expectations and next steps." /></div>
            <div className="flex justify-end border-t border-ink-900/[0.07] pt-5"><button className="mipc-button-primary" type="submit" disabled={courses.length === 0}><MegaphoneIcon className="h-4 w-4" /> Publish bulletin</button></div>
            {courses.length === 0 ? <p className="text-sm text-signal-danger">No teaching courses are assigned to this account.</p> : null}
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs" aria-labelledby="recent-bulletins">
          <div className="border-b border-ink-900/[0.07] p-5"><p className="text-xs font-semibold text-mipc-green-700">History</p><h2 id="recent-bulletins" className="mt-0.5 text-lg font-bold">Recently published</h2></div>
          <div className="mipc-content-list divide-y divide-ink-900/[0.06]">
            {announcements.slice(0, 6).map((announcement) => (
              <article key={announcement.id} className="p-5">
                <time className="text-xs text-ink-400" dateTime={announcement.published_at}>{new Date(announcement.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-ink-950">{announcement.title}</h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-ink-500">{announcement.body}</p>
              </article>
            ))}
            {announcements.length === 0 ? <p className="p-5 text-sm text-ink-500">No bulletins published yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
