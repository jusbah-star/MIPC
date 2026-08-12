import Link from 'next/link';
import { AcademicCapIcon, ChevronRightIcon } from '@/components/icons';

const primaryLinks = [
  { href: '/#programmes', label: 'Programmes' },
  { href: '/announcements', label: 'Campus news' },
  { href: '/admissions/status', label: 'Track application' }
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment-50">
      <div className="border-b border-white/10 bg-mipc-green-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 sm:px-8">
          <p className="text-[11px] font-semibold tracking-wide text-white/75 sm:text-xs">
            Muhabura Integrated Polytechnic College · Musanze, Rwanda
          </p>
          <div className="hidden items-center gap-5 text-xs text-white/70 sm:flex">
            <a className="transition hover:text-white" href="tel:+250795322300">
              +250 795 322 300
            </a>
            <a className="transition hover:text-white" href="mailto:info@mipc.ac.rw">
              info@mipc.ac.rw
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-ink-900/[0.07] bg-white/95 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mipc-green-900 text-white shadow-academic transition group-hover:-translate-y-px group-hover:shadow-academic-lg"
              aria-hidden="true"
            >
              <AcademicCapIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold leading-none tracking-[-0.03em] text-ink-950">
                MIPC
              </span>
              <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500">
                Digital Campus
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {primaryLinks.map((item) => (
              <Link key={item.href} href={item.href} className="mipc-button-ghost">
                {item.label}
              </Link>
            ))}
            <span className="mx-2 h-6 w-px bg-ink-900/10" aria-hidden="true" />
            <Link href="/admissions/apply" className="mipc-button-secondary">
              Apply now
            </Link>
            <Link href="/login" className="mipc-button-primary">
              Campus portal <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <details className="group relative md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-ink-900/10 bg-white px-3.5 text-sm font-semibold text-ink-900 shadow-xs marker:content-none">
              Menu
            </summary>
            <div className="absolute right-0 top-14 w-[min(19rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-ink-900/10 bg-white p-2 shadow-academic-lg">
              <div className="grid gap-1">
                {primaryLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-xl px-3.5 py-3 text-sm font-semibold text-ink-700 hover:bg-parchment-100 hover:text-ink-950">
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="my-2 border-t border-ink-900/[0.07]" />
              <div className="grid grid-cols-2 gap-2">
                <Link href="/admissions/apply" className="mipc-button-secondary px-3">
                  Apply
                </Link>
                <Link href="/login" className="mipc-button-primary px-3">
                  Portal
                </Link>
              </div>
            </div>
          </details>
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="bg-ink-950 text-white">
        <div className="mx-auto max-w-7xl px-5 pt-16 sm:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[1.5fr_.8fr_.8fr]">
            <div className="max-w-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-mipc-green-300">
                  <AcademicCapIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-white">MIPC Digital Campus</p>
                  <p className="text-xs text-white/50">Musanze · Northern Province · Rwanda</p>
                </div>
              </div>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Practical higher education and digital academic services designed around skills, integrity, inclusion and opportunity.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Academic services</p>
              <div className="mt-4 grid gap-3 text-sm text-white/55">
                <Link className="transition hover:text-white" href="/admissions/apply">Online application</Link>
                <Link className="transition hover:text-white" href="/admissions/status">Application status</Link>
                <Link className="transition hover:text-white" href="/login">Student & faculty portal</Link>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Information</p>
              <div className="mt-4 grid gap-3 text-sm text-white/55">
                <Link className="transition hover:text-white" href="/announcements">Campus news</Link>
                <Link className="transition hover:text-white" href="/privacy">Privacy & data rights</Link>
                <a className="transition hover:text-white" href="https://mipc.ac.rw" target="_blank" rel="noreferrer">Official MIPC website</a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Muhabura Integrated Polytechnic College</p>
            <p>Striving for Excellence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
