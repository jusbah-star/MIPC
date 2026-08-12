import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon } from '@/components/icons';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-mipc-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-white/85">Striving for Excellence · Musanze, Rwanda</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-white/70"><a href="tel:+250795322300" className="transition hover:text-white">+250 795 322 300</a><a href="mailto:info@mipc.ac.rw" className="transition hover:text-white">info@mipc.ac.rw</a></div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-mipc-navy-900/10 bg-white/95 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-mipc-navy-900/10">
              <Image src="/mipc-logo.png" alt="Muhabura Integrated Polytechnic College crest" fill sizes="56px" className="object-contain p-0.5" priority unoptimized />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-bold leading-none text-mipc-navy-950">MIPC</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-mipc-green-700">Musanze, Rwanda</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-6 text-sm font-semibold text-mipc-navy-950 md:flex">
              <Link href="/#programmes" className="transition hover:text-mipc-green-700">Programmes</Link>
              <Link href="/announcements" className="transition hover:text-mipc-green-700">News</Link>
              <Link href="/admissions/status" className="transition hover:text-mipc-green-700">Track application</Link>
            </div>
            <Link href="/login" className="mipc-button-primary !bg-mipc-green-700 px-4 sm:px-5">Campus portal <ChevronRightIcon className="h-4 w-4" /></Link>
          </div>
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="bg-mipc-navy-950 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div><p className="font-display text-2xl font-bold">Muhabura Integrated Polytechnic College</p><p className="mt-3 max-w-md text-sm leading-6 text-white/65">Practical higher education, workforce training and community development from Musanze, Rwanda.</p></div>
          <div><p className="text-sm font-bold text-mipc-green-300">Digital services</p><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/login" className="hover:text-white">Student & faculty portal</Link><Link href="/admissions/apply" className="hover:text-white">Online application</Link><Link href="/admissions/status" className="hover:text-white">Application status</Link></div></div>
          <div><p className="text-sm font-bold text-mipc-green-300">Trust & support</p><div className="mt-3 grid gap-2 text-sm text-white/65"><Link href="/privacy" className="hover:text-white">Privacy & data rights</Link><a href="https://mipc.ac.rw" target="_blank" rel="noreferrer" className="hover:text-white">Official MIPC website</a><a href="mailto:info@mipc.ac.rw" className="hover:text-white">Contact MIPC</a></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/45">© {new Date().getFullYear()} MIPC · Digital Campus</div>
      </footer>
    </div>
  );
}
