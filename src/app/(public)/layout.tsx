import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon } from '@/components/icons';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment-50">
      <div className="bg-mipc-green-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-xs sm:px-8">
          <p>Striving for Excellence · Musanze, Rwanda</p>
          <div className="flex gap-4 text-white/80"><a href="tel:+250795322300">+250 795 322 300</a><a href="mailto:info@mipc.ac.rw">info@mipc.ac.rw</a></div>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-white/95 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white shadow-academic ring-1 ring-ink-900/10">
              <Image src="/mipc-logo.png" alt="Muhabura Integrated Polytechnic College crest" fill sizes="48px" className="object-cover" priority />
            </span>
            <span className="min-w-0"><span className="block font-display text-lg font-bold leading-none">MIPC</span><span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-mipc-green-700 sm:block">Muhabura Integrated Polytechnic College</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-mipc-green-700 sm:hidden">Musanze, Rwanda</span></span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm font-semibold text-ink-800">
            <Link href="/#programmes" className="min-h-11 content-center hover:text-mipc-green-700">Programmes</Link>
            <Link href="/announcements" className="min-h-11 content-center hover:text-mipc-green-700">News</Link>
            <Link href="/admissions/status" className="hidden min-h-11 content-center hover:text-mipc-green-700 sm:block">Track application</Link>
            <Link href="/admissions/apply" className="mipc-button-secondary hidden md:inline-flex">Apply</Link>
            <Link href="/login" className="mipc-button-primary">Campus portal <ChevronRightIcon className="h-4 w-4 text-brass-300" /></Link>
          </div>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="border-t border-white/10 bg-mipc-green-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div><p className="font-display text-xl font-bold">Muhabura Integrated Polytechnic College</p><p className="mt-3 max-w-md text-sm leading-6 text-white/70">Practical higher education, workforce training and community development, guided by integrity, inclusion and Godly principles.</p></div>
          <div><p className="text-sm font-bold text-brass-300">Digital services</p><div className="mt-3 grid gap-2 text-sm text-white/70"><Link href="/login">Student & faculty portal</Link><Link href="/admissions/apply">Online application</Link><Link href="/admissions/status">Application status</Link></div></div>
          <div><p className="text-sm font-bold text-brass-300">Trust & support</p><div className="mt-3 grid gap-2 text-sm text-white/70"><Link href="/privacy">Privacy & data rights</Link><a href="https://mipc.ac.rw" target="_blank" rel="noreferrer">Official MIPC website</a><a href="mailto:info@mipc.ac.rw">Contact MIPC</a></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/55">© {new Date().getFullYear()} MIPC · Digital Campus</div>
      </footer>
    </div>
  );
}
