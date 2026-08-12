'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  AcademicCapIcon,
  AlertCircleIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  UsersIcon
} from '@/components/icons';
import type { UserRole } from '@/lib/database.types';

const demoProfiles: Array<{
  role: UserRole;
  title: string;
  description: string;
  icon: typeof UsersIcon;
}> = [
  { role: 'student', title: 'Student', description: 'Courses, coursework and examinations', icon: UsersIcon },
  { role: 'lecturer', title: 'Lecturer', description: 'Teaching, assessment and grading', icon: BookOpenIcon },
  { role: 'admin', title: 'Registrar', description: 'Admissions, users and academic records', icon: ShieldCheckIcon }
];

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '';
  const suspended = searchParams?.get('error') === 'account_suspended';
  const demoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref');

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');

    try {
      const redirectUrl = new URL('/auth/callback', window.location.origin);
      if (next && next.startsWith('/')) redirectUrl.searchParams.set('next', next);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl.toString() }
      });

      setStatus(error ? 'error' : 'sent');
    } catch {
      setStatus('error');
    }
  }

  function handleDemoLogin(role: UserRole) {
    document.cookie = `mipc_demo_role=${role}; path=/; max-age=86400`;
    const target = next && next.startsWith(`/${role}`) ? next : `/${role}`;
    router.push(target);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[.92fr_1.08fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-mipc-green-950 text-white lg:block">
        <img
          src="https://mipc.ac.rw/wp-content/uploads/elementor/thumbs/5Q2A8774-scaled-qfzekqx3vew9e5jr1c641sciixqzvx5jos3rkxugf4.jpg"
          alt="Muhabura Integrated Polytechnic College campus"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-mipc-green-950/35 via-mipc-green-950/60 to-mipc-green-950" />
        <div className="relative flex min-h-screen flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex items-center gap-3 self-start">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-mipc-green-900 shadow-academic">
              <AcademicCapIcon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-lg font-extrabold tracking-tight text-white">MIPC</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">Digital Campus</span>
            </span>
          </Link>

          <div className="max-w-xl pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mipc-green-300">Secure academic access</p>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.05em] text-white xl:text-6xl">
              One account for your MIPC journey.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-white/65">
              Access courses, assessments, admissions and academic administration through the college&apos;s secure digital campus.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {['Passwordless email sign-in', 'Role-based academic access'].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm font-medium text-white/75">
                  <CheckCircleIcon className="h-4 w-4 text-mipc-green-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40">Muhabura Integrated Polytechnic College · Musanze, Rwanda</p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-parchment-50 px-5 py-10 sm:px-8 lg:bg-white lg:px-12 xl:px-20">
        <div className="w-full max-w-[520px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-mipc-green-900 text-white">
              <AcademicCapIcon className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink-950">MIPC Digital Campus</span>
          </Link>

          <div>
            <p className="mipc-eyebrow">Welcome back</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.045em] text-ink-950 sm:text-5xl">Sign in to continue</h2>
            <p className="mt-4 text-sm leading-6 text-ink-600">
              Enter your institutional email. We&apos;ll send you a secure one-time sign-in link.
            </p>
          </div>

          <div className="mt-8">
            {suspended ? (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-signal-danger/15 bg-signal-danger-bg p-4 text-sm leading-6 text-signal-danger">
                <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>This account is suspended. Contact the MIPC Academic Registrar if you believe this is an error.</span>
              </div>
            ) : null}

            {status === 'sent' ? (
              <div className="rounded-2xl border border-mipc-green-700/10 bg-mipc-green-50 p-6 sm:p-7">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-mipc-green-700 shadow-xs">
                  <CheckCircleIcon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold">Check your email</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  We sent a secure sign-in link to <strong className="font-semibold text-ink-950">{email}</strong>. Open it on this device to continue.
                </p>
                <button type="button" onClick={() => setStatus('idle')} className="mt-5 text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-900">
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mipc-label">Institutional email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@mipc.ac.rw"
                    className="mipc-input min-h-12"
                  />
                </div>
                <button type="submit" disabled={status === 'sending'} className="mipc-button-primary min-h-12 w-full">
                  {status === 'sending' ? 'Sending secure link…' : 'Continue with email'}
                  {status !== 'sending' ? <ChevronRightIcon className="h-4 w-4" /> : null}
                </button>
                {status === 'error' ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-signal-danger-bg p-3.5 text-sm leading-6 text-signal-danger">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>We couldn&apos;t send the sign-in link. Check the email address and try again.</span>
                  </div>
                ) : null}
              </form>
            )}
          </div>

          {demoMode ? (
            <div className="mt-9 border-t border-ink-900/[0.08] pt-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">Preview the portal</p>
                  <p className="mt-1 text-xs text-ink-500">Development demo access only</p>
                </div>
                <span className="rounded-full bg-mipc-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-mipc-green-700">Demo</span>
              </div>

              <div className="mt-4 grid gap-2">
                {demoProfiles.map(({ role, title, description, icon: Icon }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemoLogin(role)}
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-ink-900/[0.08] bg-white p-3.5 text-left shadow-xs transition hover:border-mipc-green-700/20 hover:shadow-academic"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-parchment-100 text-mipc-green-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-950">{title}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{description}</span>
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-mipc-green-700" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-ink-900/[0.08] pt-6 text-xs text-ink-500">
            <Link href="/" className="font-medium transition hover:text-ink-950">← Back to MIPC</Link>
            <Link href="/privacy" className="font-medium transition hover:text-ink-950">Privacy & data rights</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-parchment-50 text-sm font-medium text-ink-500">Opening MIPC Digital Campus…</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
