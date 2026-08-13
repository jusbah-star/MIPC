import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { AcademicCapIcon, BookOpenIcon, ChevronRightIcon, FileTextIcon, ShieldCheckIcon, UsersIcon } from '@/components/icons';

const programmes = [
  { faculty: 'Hospitality & Tourism', title: 'Hospitality Management', level: 'B-Tech', icon: UsersIcon, description: 'Learn to lead service teams, manage guest experiences and grow within Rwanda’s hospitality sector.' },
  { faculty: 'Engineering Technology', title: 'Construction Technology', level: 'B-Tech', icon: BookOpenIcon, description: 'Build practical site, design and project skills through hands-on technical training.' },
  { faculty: 'Technical Education', title: 'TSS & Advanced Diploma pathways', level: 'TVET', icon: FileTextIcon, description: 'Develop job-ready technical skills through structured workshop and classroom learning.' },
  { faculty: 'Hospitality & Tourism', title: 'Travel & Tourism Management', level: 'B-Tech', icon: AcademicCapIcon, description: 'Prepare for tourism operations, destination services and a fast-moving visitor economy.' }
];

const photos = {
  hero: '/campus-front.webp',
  campus: '/campus-side.webp',
  graduation: '/api/campus-photo?name=graduation',
  construction: '/api/campus-photo?name=construction',
  community: '/leadership-community.webp'
};

export default async function HomePage() {
  let announcements = dataStore.announcements.filter((item) => item.scope === 'public').slice(0, 3);
  if (isSupabaseConfigured()) {
    const { data } = await (await createClient()).from('announcements').select('id, title, body, published_at, scope, course_id, author_id').eq('scope', 'public').order('published_at', { ascending: false }).limit(3);
    if (data) announcements = data as any;
  }

  return (
    <>
      <section className="relative isolate overflow-hidden bg-mipc-navy-950 text-white">
        <img src={photos.hero} alt="MIPC campus in Musanze" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,16,34,.98)_0%,rgba(6,16,34,.9)_42%,rgba(29,73,50,.64)_72%,rgba(6,16,34,.16)_100%)]" />
        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-8 px-5 py-14 sm:min-h-[680px] sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:min-h-[700px] lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-mipc-green-300"><span className="h-px w-9 bg-mipc-green-400" />Musanze · Rwanda · Established 2014</div>
            <h1 className="font-display text-[3.25rem] font-bold leading-[.96] tracking-tight sm:text-6xl lg:text-7xl">Practical learning.<br /><span className="text-mipc-green-300">Purposeful futures.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">MIPC brings technology, hospitality and construction education into the real world — with practical training, close support and a campus community built around integrity, service and excellence.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/admissions/apply" className="mipc-button-primary !bg-mipc-green-700 hover:!bg-mipc-green-600">Start your application <ChevronRightIcon className="h-4 w-4" /></Link><Link href="#programmes" className="mipc-button-secondary !border-white/35 !bg-transparent !text-white hover:!bg-white/10">Explore programmes <ChevronRightIcon className="h-4 w-4" /></Link></div>
          </div>
          <div className="hidden self-end lg:block lg:pb-3">
            <div className="grid grid-cols-3 overflow-hidden rounded-[1.5rem] border border-white/25 bg-white/95 text-mipc-navy-950 shadow-academic-lg backdrop-blur-sm">
              {[{ icon: BookOpenIcon, title: 'Practical', sub: 'Education' }, { icon: UsersIcon, title: 'Community', sub: 'Driven' }, { icon: ShieldCheckIcon, title: 'Excellence', sub: 'in Service' }].map(({ icon: Icon, title, sub }, index) => <div key={title} className={`px-4 py-6 text-center ${index !== 2 ? 'border-r border-mipc-navy-900/10' : ''}`}><Icon className="mx-auto h-7 w-7 text-mipc-green-700" /><p className="mt-3 text-sm font-bold">{title}</p><p className="text-xs text-ink-600">{sub}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="programmes" className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center"><p className="mipc-eyebrow !text-mipc-green-700">Programmes</p><h2 className="mt-3 text-4xl font-bold tracking-tight text-mipc-navy-950 sm:text-5xl">Build skills. Build tomorrow.</h2><p className="mt-4 text-base leading-7 text-ink-600">Choose an industry-focused pathway designed to give you practical confidence, useful experience and a clearer path into work.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{programmes.map(({ faculty, title, level, icon: Icon, description }) => <article key={title} className="group overflow-hidden rounded-[1.35rem] border border-mipc-navy-900/10 bg-white shadow-academic transition duration-300 hover:-translate-y-1 hover:shadow-academic-lg"><div className="h-2 bg-gradient-to-r from-mipc-navy-900 to-mipc-green-700" /><div className="p-6"><div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-full bg-mipc-green-50 text-mipc-green-800"><Icon className="h-5 w-5" /></span><span className="rounded-full bg-mipc-navy-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-mipc-navy-800">{level}</span></div><p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-mipc-green-700">{faculty}</p><h3 className="mt-2 text-xl font-bold leading-snug text-mipc-navy-950">{title}</h3><p className="mt-3 text-sm leading-6 text-ink-600">{description}</p><Link href="/admissions/apply" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-mipc-green-700">Learn more <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" /></Link></div></article>)}</div>
        </div>
      </section>

      <section className="bg-mipc-navy-950 text-white"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/15 sm:grid-cols-4">{[{ value: '10+', label: 'Programmes' }, { value: '1000+', label: 'Students' }, { value: 'Modern', label: 'Campus' }, { value: '2014', label: 'Established' }].map((item) => <div key={item.label} className="bg-mipc-navy-950 px-5 py-8 text-center"><p className="font-display text-3xl font-bold text-white">{item.value}</p><p className="mt-1 text-sm text-white/65">{item.label}</p></div>)}</div></section>

      <section className="bg-[#f7f8f5]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-24">
          <div><p className="mipc-eyebrow !text-mipc-green-700">Our campus</p><h2 className="mt-3 text-4xl font-bold tracking-tight text-mipc-navy-950">A place built for learning, practice and community.</h2><p className="mt-5 max-w-xl leading-7 text-ink-700">Set in Musanze, the MIPC campus brings classrooms, technical learning and student life together in one environment. It is a place to gain useful skills, meet people from different backgrounds and grow through experience.</p><a href="https://mipc.ac.rw/about" target="_blank" rel="noreferrer" className="mipc-button-secondary mt-7 !border-mipc-navy-900/15">Discover MIPC</a></div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-mipc-navy-950 shadow-academic-lg sm:aspect-[16/10]"><img src={photos.campus} alt="MIPC campus and student life" className="absolute inset-0 h-full w-full object-cover object-center" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-mipc-navy-950/20 via-transparent to-transparent" /></div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="max-w-3xl"><p className="mipc-eyebrow !text-mipc-green-700">Life at MIPC</p><h2 className="mt-3 text-4xl font-bold tracking-tight text-mipc-navy-950 sm:text-5xl">More than a classroom.</h2><p className="mt-4 text-base leading-7 text-ink-600">Study is only one part of the MIPC experience. Milestones, programme communities and leadership activities all shape the people students become.</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-12">
            <article className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-mipc-navy-950 sm:aspect-[16/10] lg:col-span-7 lg:aspect-auto lg:min-h-[500px]"><img src={photos.graduation} alt="MIPC graduates celebrating on campus" className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-mipc-navy-950/90 via-mipc-navy-950/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-mipc-green-300">Achievement</p><h3 className="mt-2 max-w-xl text-2xl font-bold sm:text-3xl">Celebrating the work behind every graduation day.</h3></div></article>
            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
              <article className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-mipc-green-900 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[240px]"><img src={photos.construction} alt="Construction and Building Technology graduates at MIPC" className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-mipc-navy-950/90 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-mipc-green-300">Programme pride</p><h3 className="mt-2 text-xl font-bold">Skills that become real careers.</h3></div></article>
              <article className="group relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-mipc-navy-950 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[240px]"><img src={photos.community} alt="MIPC leadership and community gathering" className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.02]" loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-mipc-navy-950/90 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-mipc-green-300">Leadership & community</p><h3 className="mt-2 text-xl font-bold">Growing confidence beyond the lecture room.</h3></div></article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mipc-navy-950 text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-24"><div><p className="mipc-eyebrow !text-mipc-green-300">Why MIPC</p><h2 className="mt-3 text-4xl font-bold">Education with skill, character and community.</h2><p className="mt-5 leading-7 text-white/70">Practical learning matters most when it helps students become capable, thoughtful and ready to contribute.</p></div><div className="grid gap-4 sm:grid-cols-3">{[{ icon: ShieldCheckIcon, title: 'Integrity', text: 'Clear standards, responsible decisions and respect for every learner.' }, { icon: BookOpenIcon, title: 'Practice', text: 'Workshops, projects and real-world learning across our programmes.' }, { icon: UsersIcon, title: 'Belonging', text: 'A supportive campus where students can learn, grow and contribute.' }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-[1.35rem] border border-white/10 bg-white/5 p-6"><Icon className="h-7 w-7 text-mipc-green-300" /><h3 className="mt-5 text-xl font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{text}</p></div>)}</div></div></section>

      <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mipc-eyebrow !text-mipc-green-700">Campus bulletin</p><h2 className="mt-3 text-4xl font-bold text-mipc-navy-950">Latest from MIPC</h2></div><Link href="/announcements" className="mipc-button-secondary">View all news</Link></div><div className="mt-9 grid gap-5 lg:grid-cols-3">{announcements.map((item) => <article key={item.id} className="flex min-h-64 flex-col rounded-[1.35rem] border border-mipc-navy-900/10 bg-white p-6 shadow-academic"><p className="text-xs font-semibold uppercase tracking-wider text-mipc-green-700">{new Date(item.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}</p><h3 className="mt-4 text-xl font-bold leading-snug text-mipc-navy-950">{item.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-600">{item.body}</p><Link href="/announcements" className="mt-auto pt-6 text-sm font-bold text-mipc-green-700">Read bulletin</Link></article>)}</div></div></section>
    </>
  );
}
