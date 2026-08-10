'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  AcademicCapIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  UsersIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from '@/components/icons';
import type { UserRole } from '@/lib/database.types';

import { Suspense } from 'react';

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
      if (next && next.startsWith('/')) {
        redirectUrl.searchParams.set('next', next);
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString()
        }
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
    <main className="min-h-screen bg-parchment-50 flex flex-col justify-between py-12 px-6">
      <div className="max-w-md w-full mx-auto my-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group mb-4">
            <div className="w-12 h-12 rounded-xl bg-ink-900 border border-mipc-green-500/40 flex items-center justify-center text-mipc-green-400 shadow-academic">
              <AcademicCapIcon className="w-7 h-7" />
            </div>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Institutional Sign In
          </h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-wider text-mipc-green-700 font-bold">
            Muhabura Integrated Polytechnic College (MIPC)
          </p>
          <p className="text-[11px] font-mono text-ink-500 italic mt-0.5">
            &ldquo;Striving for Excellence&rdquo; · Musanze, Rwanda
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-900/10 p-8 shadow-academic">
          {suspended && <div className="mb-5 flex items-start gap-2 rounded-xl border border-signal-danger/25 bg-signal-danger-bg p-3 text-sm text-signal-danger"><AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /><span>This account is suspended. Contact the MIPC Academic Registrar if you believe this is an error.</span></div>}
          {status === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-signal-ok-bg text-signal-ok flex items-center justify-center mx-auto mb-3">
                <CheckCircleIcon className="w-7 h-7" />
              </div>
              <h2 className="font-display text-lg font-bold text-ink-950">
                Magic Link Dispatched
              </h2>
              <p className="mt-2 text-xs text-ink-700 leading-relaxed font-mono">
                An authenticated login link has been issued to <strong className="text-ink-950">{email}</strong>. Check your inbox to proceed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-ink-800 mb-1.5">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mipc.ac.rw"
                  className="w-full rounded-lg border border-ink-900/15 px-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-400 outline-none focus-visible:border-mipc-green-500 bg-parchment-50/50"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-lg bg-ink-900 py-2.5 px-4 text-sm font-medium text-white hover:bg-ink-800 transition-colors shadow-xs disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending magic link…' : 'Send Authenticated Link'}
              </button>
              {status === 'error' && (
                <div className="flex items-center gap-2 text-xs text-signal-danger bg-signal-danger-bg p-2.5 rounded-lg">
                  <AlertCircleIcon className="w-4 h-4 shrink-0" />
                  <span>Unable to dispatch OTP. You can use 1-Click Demo below.</span>
                </div>
              )}
            </form>
          )}

          {/* Quick 1-Click Demo Profiles */}
          {demoMode && <div className="mt-8 pt-6 border-t border-ink-900/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-600 font-bold">
                Instant Demo Exploration
              </span>
              <span className="text-[10px] font-mono bg-mipc-green-100 text-mipc-green-800 px-2 py-0.5 rounded font-semibold border border-mipc-green-200">
                1-Click Access
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('student')}
                className="w-full text-left p-3 rounded-lg border border-parchment-300 bg-parchment-50/60 hover:bg-parchment-100/90 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-ink-900 text-mipc-green-400 flex items-center justify-center font-mono text-xs font-bold">
                    <UsersIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-950 flex items-center gap-2">
                      <span>Jean-Luc Habimana</span>
                      <span className="text-[10px] font-mono uppercase bg-mipc-green-100 text-mipc-green-800 px-1.5 py-0.2 rounded font-semibold">
                        Student
                      </span>
                    </div>
                    <div className="text-xs text-ink-600 font-mono">
                      B-Tech Software Engineering · ICT
                    </div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-ink-400 group-hover:text-mipc-green-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('lecturer')}
                className="w-full text-left p-3 rounded-lg border border-parchment-300 bg-parchment-50/60 hover:bg-parchment-100/90 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-ink-900 text-mipc-green-400 flex items-center justify-center font-mono text-xs font-bold">
                    <BookOpenIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-950 flex items-center gap-2">
                      <span>Eng. Dr. Emmanuel Ndayisaba</span>
                      <span className="text-[10px] font-mono uppercase bg-mipc-green-100 text-mipc-green-800 px-1.5 py-0.2 rounded font-semibold">
                        Faculty
                      </span>
                    </div>
                    <div className="text-xs text-ink-600 font-mono">
                      Senior Lecturer · Head of ICT Faculty
                    </div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-ink-400 group-hover:text-mipc-green-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="w-full text-left p-3 rounded-lg border border-parchment-300 bg-parchment-50/60 hover:bg-parchment-100/90 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-ink-900 text-mipc-green-400 flex items-center justify-center font-mono text-xs font-bold">
                    <ShieldCheckIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink-950 flex items-center gap-2">
                      <span>Rev. Dr. Laurent Shyaka</span>
                      <span className="text-[10px] font-mono uppercase bg-mipc-green-100 text-mipc-green-800 px-1.5 py-0.2 rounded font-semibold">
                        Registrar
                      </span>
                    </div>
                    <div className="text-xs text-ink-600 font-mono">
                      Office of the Academic Registrar & Admissions
                    </div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-ink-400 group-hover:text-mipc-green-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>}
        </div>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs font-mono text-ink-600 hover:text-ink-950 transition-colors"
          >
            &larr; Return to MIPC Official Portal
          </Link>
        </div>
      </div>

      <footer className="text-center text-xs text-ink-500 font-mono">
        Muhabura Integrated Polytechnic College · Musanze, Northern Province, Rwanda
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-parchment-50 flex items-center justify-center font-mono text-ink-500">Loading MIPC Portal...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
