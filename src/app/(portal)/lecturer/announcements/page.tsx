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
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="mipc-eyebrow">Faculty communications</p>
        <h1 className="mipc-page-title">Publish a course bulletin</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-700">Send a clear, traceable notice to students enrolled in one of your courses.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <form action={publishCourseAnnouncement} className="mipc-panel space-y-5 p-6 sm:p-8">
          <div>
            <label className="mipc-label" htmlFor="course_id">Course</label>
            <select id="course_id" name="course_id" required className="mipc-input">
              <option value="">Select a course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mipc-label" htmlFor="title">Headline</label>
            <input id="title" name="title" required minLength={4} maxLength={180} className="mipc-input" placeholder="What students need to know" />
          </div>
          <div>
            <label className="mipc-label" htmlFor="body">Message</label>
            <textarea id="body" name="body" required minLength={10} maxLength={5000} rows={8} className="mipc-input" placeholder="Include dates, expectations and a contact point." />
          </div>
          <button className="mipc-button-primary" type="submit" disabled={courses.length === 0}>
            <MegaphoneIcon className="h-4 w-4" /> Publish bulletin
          </button>
          {courses.length === 0 && <p className="text-sm text-signal-danger">No teaching courses are assigned to this account.</p>}
        </form>

        <section className="mipc-panel p-5" aria-labelledby="recent-bulletins">
          <h2 id="recent-bulletins" className="font-display text-lg font-bold text-ink-950">Recently published</h2>
          <div className="mt-4 space-y-4">
            {announcements.slice(0, 6).map((announcement) => (
              <article key={announcement.id} className="border-b border-parchment-200 pb-4 last:border-0">
                <time className="text-xs text-ink-500" dateTime={announcement.published_at}>{new Date(announcement.published_at).toLocaleDateString('en-RW')}</time>
                <h3 className="mt-1 text-sm font-bold text-ink-950">{announcement.title}</h3>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-ink-600">{announcement.body}</p>
              </article>
            ))}
            {announcements.length === 0 && <p className="text-sm text-ink-600">No bulletins published yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
