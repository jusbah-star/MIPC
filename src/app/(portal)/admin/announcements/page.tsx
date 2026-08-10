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
    const { data, error } = await supabase.from('announcements').select('*').in('scope', ['public', 'college']).order('published_at', { ascending: false });
    if (error) throw new Error(error.message);
    announcements = (data ?? []) as any;
  }
  return <div className="mx-auto max-w-5xl space-y-8">
    <header><p className="mipc-eyebrow">Registrar communications</p><h1 className="mipc-page-title">Global college announcements</h1><p className="mt-2 max-w-2xl text-sm text-ink-700">Public notices appear on the MIPC website. College notices are restricted to active authenticated accounts.</p></header>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_.7fr]">
      <form action={publishGlobalAnnouncement} className="mipc-panel space-y-5 p-6 sm:p-8">
        <div><label className="mipc-label" htmlFor="scope">Audience</label><select className="mipc-input" id="scope" name="scope" required><option value="college">Authenticated college community</option><option value="public">Public MIPC website</option></select></div>
        <div><label className="mipc-label" htmlFor="title">Headline</label><input className="mipc-input" id="title" name="title" required minLength={4} maxLength={180} /></div>
        <div><label className="mipc-label" htmlFor="body">Announcement</label><textarea className="mipc-input" id="body" name="body" required minLength={10} maxLength={5000} rows={8} /></div>
        <button type="submit" className="mipc-button-primary"><MegaphoneIcon className="h-4 w-4" /> Publish announcement</button>
      </form>
      <section className="mipc-panel p-5" aria-labelledby="published-global-title"><h2 id="published-global-title" className="flex items-center gap-2 font-display text-lg font-bold text-ink-950"><ShieldCheckIcon className="h-5 w-5 text-mipc-green-700" /> Published register</h2><div className="mt-4 space-y-4">{announcements.slice(0, 8).map((item) => <article key={item.id} className="border-b border-parchment-200 pb-4 last:border-0"><div className="flex justify-between gap-2"><span className="mipc-status">{item.scope}</span><time className="text-xs text-ink-500">{new Date(item.published_at).toLocaleDateString('en-RW')}</time></div><h3 className="mt-2 text-sm font-bold text-ink-950">{item.title}</h3><p className="mt-1 line-clamp-3 text-xs leading-5 text-ink-600">{item.body}</p></article>)}{announcements.length === 0 && <p className="text-sm text-ink-600">No global announcements yet.</p>}</div></section>
    </div>
  </div>;
}
