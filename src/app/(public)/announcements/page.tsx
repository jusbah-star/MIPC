import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  AcademicCapIcon,
  MegaphoneIcon,
  ChevronRightIcon,
  ClockIcon
} from '@/components/icons';

export default async function AnnouncementsPage() {
  let announcements = dataStore.announcements;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('announcements')
        .select('id, scope, title, body, published_at')
        .order('published_at', { ascending: false });

      if (data && data.length > 0) {
        announcements = data as any;
      }
    } catch {
      // Fallback
    }
  }

  return (
    <div className="min-h-screen bg-parchment-50 flex flex-col justify-between">
      <main className="max-w-4xl w-full mx-auto px-6 py-12">
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-wider text-mipc-green-700 font-bold block mb-1">
            Official Gazettes & Bulletins
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950">
            MIPC Academic Bulletins
          </h1>
          <p className="mt-2 text-sm text-ink-700">
            Directives from the Principal, Academic Registrar, examination timetables, and campus announcements for Musanze campus.
          </p>
        </div>

        <div className="space-y-4">
          {announcements.map((a) => (
            <article
              key={a.id}
              className="bg-white rounded-xl border border-ink-900/10 p-6 shadow-xs hover:border-mipc-green-500/50 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span
                  className={`text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                    a.scope === 'public'
                      ? 'bg-mipc-green-100 text-mipc-green-800'
                      : a.scope === 'college'
                      ? 'bg-ink-900/10 text-ink-800'
                      : 'bg-signal-ok-bg text-signal-ok'
                  }`}
                >
                  {a.scope === 'public' ? 'Public Gazette' : a.scope === 'college' ? 'Campus Notice' : 'Course Bulletin'}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-ink-500 font-mono">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <time dateTime={a.published_at}>
                    {new Date(a.published_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </time>
                </div>
              </div>

              <h2 className="font-display text-lg font-bold text-ink-950 mb-2">
                {a.title}
              </h2>
              <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-line">
                {a.body}
              </p>
            </article>
          ))}

          {announcements.length === 0 && (
            <div className="bg-white rounded-xl border border-ink-900/10 p-12 text-center text-ink-500 text-sm">
              No bulletins published for this period.
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-ink-900/10 bg-white py-6 text-center text-xs text-ink-500 font-mono">
        Muhabura Integrated Polytechnic College (MIPC) · Official Gazette & Records · Musanze, Rwanda
      </footer>
    </div>
  );
}
