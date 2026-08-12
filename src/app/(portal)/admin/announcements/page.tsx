import { redirect } from 'next/navigation';
import { MegaphoneIcon, ShieldCheckIcon } from '@/components/icons';
import { dataStore } from '@/lib/data-store';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { publishGlobalAnnouncement } from './actions';

export default async function AdminAnnouncementsPage() {
  let announcements: any[] = dataStore.announcements.filter((item) => item.scope !== 'course');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .in('scope', ['public', 'college'])
      .order('published_at', { ascending: false });
    if (error) throw new Error(error.message);
    announcements = (data ?? []) as any;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="mipc-eyebrow">Announcements</p>
        <h1 className="mipc-page-title">College communications</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">Publish notices to the authenticated college community or to the public MIPC website.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <form action={publishGlobalAnnouncement} className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8">
          <div className="flex items-center gap-3 border-b border-ink-900/[0.07] pb-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700"><MegaphoneIcon className="h-5 w-5" /></span>
            <div><p className="text-xs font-semibold text-mipc-green-700">New announcement</p><h2 className="mt-0.5 text-lg font-bold">Compose message</h2></div>
          </div>

          <div className="mt-6 grid gap-5">
            <div>
              <label className="mipc-label" htmlFor="scope">Audience</label>
              <select className="mipc-input" id="scope" name="scope" required>
                <option value="college">Authenticated college community</option>
                <option value="public">Public MIPC website</option>
              </select>
            </div>
            <div>
              <label className="mipc-label" htmlFor="title">Headline</label>
              <input className="mipc-input" id="title" name="title" required minLength={4} maxLength={180} placeholder="Clear, specific announcement title" />
            </div>
            <div>
              <label className="mipc-label" htmlFor="body">Announcement</label>
              <textarea className="mipc-input" id="body" name="body" required minLength={10} maxLength={5000} rows={9} placeholder="Write the announcement, including any dates or actions readers need to know." />
            </div>
            <div className="flex justify-end border-t border-ink-900/[0.07] pt-5">
              <button type="submit" className="mipc-button-primary"><MegaphoneIcon className="h-4 w-4" /> Publish announcement</button>
            </div>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs" aria-labelledby="published-global-title">
          <div className="flex items-center justify-between gap-3 border-b border-ink-900/[0.07] p-5">
            <div><p className="text-xs font-semibold text-mipc-green-700">Published</p><h2 id="published-global-title" className="mt-0.5 text-lg font-bold">Recent messages</h2></div>
            <ShieldCheckIcon className="h-5 w-5 text-mipc-green-700" />
          </div>
          <div className="mipc-content-list divide-y divide-ink-900/[0.06]">
            {announcements.slice(0, 8).map((item) => (
              <article key={item.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-mipc-green-700">{item.scope}</span>
                  <time className="text-xs text-ink-400">{new Date(item.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'short' })}</time>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-ink-950">{item.title}</h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-ink-500">{item.body}</p>
              </article>
            ))}
            {announcements.length === 0 ? <p className="p-5 text-sm text-ink-500">No global announcements yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
