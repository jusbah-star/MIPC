import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import {
  AcademicCapIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  FileTextIcon,
  ShieldCheckIcon,
  UsersIcon
} from '@/components/icons';

const programmes = [
  {
    faculty: 'Engineering Technology',
    title: 'Construction Technology',
    level: 'B-Tech',
    summary: 'Technical design, site practice and modern construction delivery.',
    icon: BookOpenIcon
  },
  {
    faculty: 'Hospitality & Tourism',
    title: 'Hospitality Management',
    level: 'B-Tech',
    summary: 'Operations, guest experience and leadership for the service economy.',
    icon: UsersIcon
  },
  {
    faculty: 'Hospitality & Tourism',
    title: 'Travel & Tourism Management',
    level: 'B-Tech',
    summary: 'Tourism operations, destination experience and sustainable enterprise.',
    icon: AcademicCapIcon
  },
  {
    faculty: 'Technical Education',
    title: 'TSS & Advanced Diploma pathways',
    level: 'TVET',
    summary: 'Applied technical pathways designed for progression and employability.',
    icon: FileTextIcon
  }
];

const proofPoints = [
  ['2014', 'Serving learners since'],
  ['Musanze', 'Northern Province campus'],
  ['Practical', 'Career-focused learning'],
  ['Digital', 'Admissions & academic services']
];

export default async function HomePage() {
  let announcements = dataStore.announcements.filter((item) => item.scope === 'public').slice(0, 3);

  if (isSupabaseConfigured()) {
    const { data } = await (await createClient())
      .from('announcements')
      .select('id, title, body, published_at, scope, course_id, author_id')
      .eq('scope', 'public')
      .order('published_at', { ascending: false })
      .limit(3);

    if (data) announcements = data as any;
  }

  return (
    <>
      <section className="relative overflow-hidden bg-parchment-50">
        <div className="pointer-events-none absolute inset-0 mipc-soft-grid opacity-45" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:py-24">
          <div className="max-w-2xl">
            <p className="mipc-eyebrow">Musanze · Rwanda</p>
            <h1 className="mt-5 max-w-xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-ink-950 sm:text-6xl lg:text-[4.5rem]">
              Learn the work.
              <span className="mt-1 block text-mipc-green-700">Build what comes next.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-ink-600 sm:text-lg sm:leading-8">
              Practical higher education in engineering technology, hospitality, tourism and technical education—supported by a secure digital campus from application to graduation.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/admissions/apply" className="mipc-button-primary w-full sm:w-auto">
                Start an application <ChevronRightIcon className="h-4 w-4" />
              </Link>
              <Link href="#programmes" className="mipc-button-secondary w-full sm:w-auto">
                Explore programmes
              </Link>
            </div>

            <div className="mt-9 grid gap-3 border-t border-ink-900/[0.08] pt-6 sm:grid-cols-2">
              {['Online application & status tracking', 'Secure student and faculty workspace'].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
                  <CheckCircleIcon className="h-[18px] w-[18px] shrink-0 text-mipc-green-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[430px] lg:min-h-[560px]">
            <div className="absolute inset-x-4 top-4 bottom-10 overflow-hidden rounded-[2rem] bg-mipc-green-950 shadow-float sm:inset-x-8 lg:inset-x-0 lg:left-10">
              <img
                src="https://mipc.ac.rw/wp-content/uploads/elementor/thumbs/5Q2A8774-scaled-qfzekqx3vew9e5jr1c641sciixqzvx5jos3rkxugf4.jpg"
                alt="Students and staff at Muhabura Integrated Polytechnic College campus"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/65 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">MIPC Campus</p>
                <p className="mt-2 max-w-sm font-display text-2xl font-bold tracking-tight text-white">
                  Skills built through real practice.
                </p>
              </div>
            </div>

            <div className="absolute left-0 top-0 max-w-[230px] rounded-2xl border border-ink-900/[0.08] bg-white p-4 shadow-academic-lg sm:p-5">
              <p className="text-xs font-semibold text-mipc-green-700">Admissions 2026/2027</p>
              <p className="mt-1.5 text-sm font-bold text-ink-950">Applications are managed online</p>
              <Link href="/admissions/status" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-mipc-green-700">
                Track an application <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
          <div className="grid overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-white shadow-xs sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map(([value, label], index) => (
              <div key={label} className={`p-5 sm:p-6 ${index ? 'border-t border-ink-900/[0.07] sm:border-l sm:border-t-0' : ''}`}>
                <p className="font-display text-xl font-bold tracking-tight text-ink-950">{value}</p>
                <p className="mt-1 text-xs font-medium text-ink-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="programmes" className="border-y border-ink-900/[0.06] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div>
              <p className="mipc-eyebrow">Programmes</p>
              <h2 className="mt-4 max-w-md font-display text-4xl font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">
                Education designed around doing.
              </h2>
            </div>
            <div className="lg:pb-1">
              <p className="max-w-2xl text-base leading-7 text-ink-600">
                MIPC combines classroom foundations with workshop, site and service-industry practice so graduates leave with usable skills—not only theory.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {programmes.map(({ faculty, title, level, summary, icon: Icon }, index) => (
              <article key={title} className="group rounded-2xl border border-ink-900/[0.08] bg-parchment-50 p-6 transition duration-200 hover:border-mipc-green-700/20 hover:bg-white hover:shadow-academic-lg sm:p-7">
                <div className="flex items-start justify-between gap-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-mipc-green-100 text-mipc-green-800">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{faculty}</span>
                  </div>
                  <span className="text-xs font-semibold text-mipc-green-700">0{index + 1}</span>
                </div>
                <div className="mt-8 flex items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-600 shadow-xs">{level}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold tracking-[-0.025em]">{title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-ink-600">{summary}</p>
                <Link href="/admissions/apply" className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-mipc-green-700">
                  Apply to this pathway <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-24">
          <div className="max-w-lg">
            <p className="mipc-eyebrow !text-mipc-green-300 before:!bg-mipc-green-300/70">Why MIPC</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
              Skill, character and community belong together.
            </h2>
            <p className="mt-6 text-base leading-7 text-white/60">
              Founded by the Anglican Church of Rwanda, Diocese of Shyira, MIPC connects practical learning with integrity, service and regional opportunity.
            </p>
            <a href="https://mipc.ac.rw/about" target="_blank" rel="noreferrer" className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              Read the MIPC story
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheckIcon, title: 'Integrity', text: 'Protected records, accountable decisions and transparent academic processes.' },
              { icon: BookOpenIcon, title: 'Practice', text: 'Learning shaped by workshops, projects and real workplace expectations.' },
              { icon: UsersIcon, title: 'Belonging', text: 'A focused campus community with academic and personal support.' }
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
                <Icon className="h-6 w-6 text-mipc-green-300" />
                <h3 className="mt-8 text-xl font-bold tracking-tight text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mipc-eyebrow">Campus bulletin</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">Latest from MIPC</h2>
          </div>
          <Link href="/announcements" className="mipc-button-secondary w-full sm:w-auto">
            View all news
          </Link>
        </div>

        <div className="mipc-content-list mt-10 grid gap-4 lg:grid-cols-3">
          {announcements.map((item, index) => (
            <article key={item.id} className="group flex min-h-72 flex-col rounded-2xl border border-ink-900/[0.08] bg-white p-6 shadow-xs transition hover:border-mipc-green-700/20 hover:shadow-academic-lg sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold text-ink-500">
                  {new Date(item.published_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <span className="text-xs font-semibold text-mipc-green-700">0{index + 1}</span>
              </div>
              <h3 className="mt-7 text-xl font-bold leading-snug tracking-[-0.02em]">{item.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-600">{item.body}</p>
              <Link href="/announcements" className="mt-auto inline-flex items-center gap-1 pt-8 text-sm font-semibold text-mipc-green-700">
                Read bulletin <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
