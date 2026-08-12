import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { ClockIcon, MegaphoneIcon } from '@/components/icons';

export default async function AnnouncementsPage() {
  let announcements = dataStore.announcements;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('announcements')
        .select('id, scope, title, body, published_at')
        .order('published_at', { ascending: false });

      if (data && data.length > 0) announcements = data as any;
    } catch {
      // Keep the local fallback if the bulletin feed is temporarily unavailable.
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="mipc-eyebrow">Campus news</p>
          <h1 className="mt-4 max-w-md font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-5xl">What&apos;s happening at MIPC.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ink-600">Official announcements, academic updates and campus notices from Muhabura Integrated Polytechnic College.</p>

          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-mipc-green-950 p-5 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-mipc-green-300"><MegaphoneIcon className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-white">Official MIPC feed</p>
              <p className="mt-1 text-xs leading-5 text-white/50">Published notices appear here in reverse chronological order.</p>
            </div>
          </div>
        </aside>

        <section>
          <div className="flex items-end justify-between gap-4 border-b border-ink-900/[0.08] pb-5">
            <div>
              <p className="text-xs font-semibold text-mipc-green-700">Latest updates</p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em]">Bulletins & announcements</h2>
            </div>
            <span className="text-xs font-medium text-ink-400">{announcements.length} published</span>
          </div>

          <div className="mipc-content-list divide-y divide-ink-900/[0.07]">
            {announcements.map((announcement, index) => (
              <article key={announcement.id} className="group py-7 first:pt-7 sm:py-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    announcement.scope === 'public'
                      ? 'bg-mipc-green-50 text-mipc-green-700'
                      : announcement.scope === 'college'
                        ? 'bg-parchment-200 text-ink-600'
                        : 'bg-mipc-navy-50 text-mipc-navy-700'
                  }`}>
                    {announcement.scope === 'public' ? 'Public' : announcement.scope === 'college' ? 'College' : 'Course'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-ink-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    <time dateTime={announcement.published_at}>
                      {new Date(announcement.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </time>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[44px_minmax(0,1fr)]">
                  <span className="text-xs font-semibold text-ink-300">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold leading-snug tracking-[-0.02em] text-ink-950 sm:text-2xl">{announcement.title}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink-600">{announcement.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {announcements.length === 0 ? <div className="mipc-empty mt-6">No campus updates have been published yet.</div> : null}
        </section>
      </div>
    </div>
  );
}
