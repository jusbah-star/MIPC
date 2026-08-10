import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { AcademicCapIcon, BookOpenIcon, CheckCircleIcon, ChevronRightIcon, FileTextIcon, ShieldCheckIcon, UsersIcon } from '@/components/icons';

const programmes = [
  { faculty: 'Engineering Technology', title: 'Construction Technology', level: 'B‑Tech', icon: BookOpenIcon },
  { faculty: 'Hospitality & Tourism', title: 'Hospitality Management', level: 'B‑Tech', icon: UsersIcon },
  { faculty: 'Hospitality & Tourism', title: 'Travel & Tourism Management', level: 'B‑Tech', icon: AcademicCapIcon },
  { faculty: 'Technical Education', title: 'TSS & Advanced Diploma pathways', level: 'TVET', icon: FileTextIcon }
];

export default async function HomePage() {
  let announcements = dataStore.announcements.filter((item) => item.scope === 'public').slice(0, 3);
  if (isSupabaseConfigured()) {
    const { data } = await (await createClient()).from('announcements').select('id, title, body, published_at, scope, course_id, author_id').eq('scope', 'public').order('published_at', { ascending: false }).limit(3);
    if (data) announcements = data as any;
  }

  return (
    <>
      <section className="relative isolate overflow-hidden bg-mipc-green-950 text-white">
        <img src="https://mipc.ac.rw/wp-content/uploads/elementor/thumbs/5Q2A8774-scaled-qfzekqx3vew9e5jr1c641sciixqzvx5jos3rkxugf4.jpg" alt="Students and staff at Muhabura Integrated Polytechnic College campus" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-mipc-green-950 via-mipc-green-950/90 to-mipc-green-900/35" />
        <div className="relative mx-auto grid min-h-[650px] min-w-0 max-w-7xl grid-cols-1 items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_.8fr]">
          <div className="min-w-0 max-w-3xl">
            <p className="mipc-eyebrow !text-brass-300">Musanze · Rwanda · Established 2014</p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl sm:leading-[1.04] lg:text-7xl">Practical learning.<br className="hidden sm:block" /> <span className="text-brass-300">Purposeful futures.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">MIPC combines hands-on technology, hospitality and construction education with a community shaped by integrity, service and excellence.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link href="/admissions/apply" className="mipc-button-primary w-full !bg-brass-400 !text-ink-950 hover:!bg-brass-300 sm:w-auto">Start your application <ChevronRightIcon className="h-4 w-4" /></Link><Link href="#programmes" className="mipc-button-secondary w-full !border-white/25 !bg-white/10 !text-white hover:!bg-white/15 sm:w-auto">Explore programmes</Link></div>
          </div>
          <div className="mipc-card min-w-0 overflow-hidden border-white/15 bg-white/10 p-6 text-white backdrop-blur-md sm:p-8">
            <p className="mipc-eyebrow !text-brass-300">Digital campus</p><h2 className="mt-3 text-2xl font-bold">One secure place for your MIPC journey</h2>
            <div className="mt-6 grid gap-4">{['Track admissions from submission to decision', 'Access enrolled modules and coursework', 'Take server-timed examinations securely', 'Receive official academic announcements'].map((item) => <div key={item} className="flex gap-3 text-sm leading-6 text-white/80"><CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brass-300" />{item}</div>)}</div>
            <Link href="/login" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brass-300">Open campus portal <ChevronRightIcon className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section id="programmes" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl"><p className="mipc-eyebrow">Learn by doing</p><h2 className="mt-3 text-4xl font-bold tracking-tight">Programmes built for Rwanda’s workforce</h2><p className="mt-4 text-base leading-7 text-ink-700">Explore pathways across engineering technology, hospitality, tourism and technical secondary education.</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{programmes.map(({ faculty, title, level, icon: Icon }) => <article key={title} className="mipc-card group p-6 transition hover:-translate-y-1 hover:shadow-academic-lg"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800"><Icon className="h-5 w-5" /></span><span className="rounded-full bg-brass-300/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brass-700">{level}</span></div><p className="mt-6 text-xs font-semibold uppercase tracking-wider text-mipc-green-700">{faculty}</p><h3 className="mt-2 text-xl font-bold leading-snug">{title}</h3><Link href="/admissions/apply" className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-mipc-green-700">Apply to MIPC <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" /></Link></article>)}</div>
      </section>

      <section className="bg-mipc-green-50/80"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]"><div><p className="mipc-eyebrow">Why MIPC</p><h2 className="mt-3 text-4xl font-bold">Education with skill, character and community.</h2><p className="mt-5 leading-7 text-ink-700">Founded by the Anglican Church of Rwanda, Diocese of Shyira, MIPC’s mission connects innovative learning with regional growth and opportunity.</p><a href="https://mipc.ac.rw/about" target="_blank" rel="noreferrer" className="mipc-button-secondary mt-7">Read the MIPC story</a></div><div className="grid gap-5 sm:grid-cols-3">{[{ icon: ShieldCheckIcon, title: 'Integrity', text: 'Transparent records, protected data and accountable decisions.' }, { icon: BookOpenIcon, title: 'Practice', text: 'Workshops and real-world learning at the centre of every pathway.' }, { icon: UsersIcon, title: 'Belonging', text: 'An inclusive campus community with academic and personal support.' }].map(({ icon: Icon, title, text }) => <div key={title} className="mipc-card p-6"><Icon className="h-7 w-7 text-mipc-green-700" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-700">{text}</p></div>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mipc-eyebrow">Campus bulletin</p><h2 className="mt-3 text-4xl font-bold">Latest from MIPC</h2></div><Link href="/announcements" className="mipc-button-secondary">View all news</Link></div><div className="mt-9 grid gap-5 lg:grid-cols-3">{announcements.map((item) => <article key={item.id} className="mipc-card flex min-h-64 flex-col p-6"><p className="text-xs font-semibold uppercase tracking-wider text-mipc-green-700">{new Date(item.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}</p><h3 className="mt-4 text-xl font-bold leading-snug">{item.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-700">{item.body}</p><Link href="/announcements" className="mt-auto pt-6 text-sm font-bold text-mipc-green-700">Read bulletin</Link></article>)}</div></section>
    </>
  );
}
