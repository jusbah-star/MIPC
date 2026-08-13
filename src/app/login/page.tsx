'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AlertCircleIcon, CheckCircleIcon, ChevronRightIcon, ShieldCheckIcon } from '@/components/icons';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') ?? '';
  const suspended = searchParams?.get('error') === 'account_suspended';

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'identity' | 'code'>('identity');
  const [status, setStatus] = useState<'idle' | 'sending' | 'verifying' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function sendCode() {
    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber, email })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setMessage(payload.error || 'We could not send your login code.');
        return;
      }

      setStep('code');
      setStatus('idle');
    } catch {
      setStatus('error');
      setMessage('We could not reach the sign-in service. Please try again.');
    }
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('verifying');
    setMessage('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email'
      });

      if (error || !data.user) {
        setStatus('error');
        setMessage('That code is invalid or has expired. Check the email and try again.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('id', data.user.id)
        .single();

      if (!profile || profile.account_status !== 'active') {
        await supabase.auth.signOut();
        setStatus('error');
        setMessage('This MIPC account is not active. Please contact the Academic Registrar.');
        return;
      }

      const role = profile.role;
      const safeNext = next.startsWith(`/${role}`) ? next : `/${role}`;
      router.replace(safeNext);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('We could not verify the code. Please try again.');
    }
  }

  function startAgain() {
    setStep('identity');
    setCode('');
    setStatus('idle');
    setMessage('');
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-mipc-navy-950 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src="/api/campus-photo?name=hero" alt="MIPC campus" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,16,34,.96),rgba(6,16,34,.82)_52%,rgba(29,73,50,.78))]" />

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white shadow-lg">
            <img src="/api/mipc-logo" alt="MIPC crest" className="h-full w-full object-contain p-1" />
          </span>
          <span><span className="block text-2xl font-bold">MIPC</span><span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Digital Campus</span></span>
        </Link>

        <div className="relative z-10 max-w-xl pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-mipc-green-300">Secure campus access</p>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.03] xl:text-6xl">Your campus,<br />one secure code away.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/72">Use your MIPC registration number and the email registered on your student or staff record. We will send a one-time code to confirm it is really you.</p>

          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {['No password to remember', 'Code sent to your email', 'Protected institutional access'].map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/12 bg-white/7 p-4 backdrop-blur-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-mipc-green-600 text-xs font-bold">{index + 1}</span>
                <p className="mt-3 text-sm font-semibold leading-5 text-white/85">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/45">Muhabura Integrated Polytechnic College · Musanze, Rwanda</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-white shadow-academic ring-1 ring-mipc-navy-900/10">
                <img src="/api/mipc-logo" alt="MIPC crest" className="h-full w-full object-contain p-1" />
              </span>
              <span className="text-left"><span className="block font-display text-2xl font-bold text-mipc-navy-950">MIPC</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-mipc-green-700">Digital Campus</span></span>
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-mipc-navy-900/10 bg-white p-6 shadow-academic sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-mipc-green-700">Campus portal</p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-mipc-navy-950">{step === 'identity' ? 'Sign in to MIPC' : 'Check your email'}</h2>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mipc-green-50 text-mipc-green-700"><ShieldCheckIcon className="h-5 w-5" /></span>
            </div>

            {suspended && <div className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger/20 bg-signal-danger-bg p-3 text-sm text-signal-danger"><AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /><span>This account is suspended. Contact the MIPC Academic Registrar.</span></div>}

            {step === 'identity' ? (
              <form onSubmit={requestCode} className="mt-7 space-y-5">
                <div>
                  <label htmlFor="registrationNumber" className="mipc-label">Registration number</label>
                  <input id="registrationNumber" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value.toUpperCase())} className="mipc-field !min-h-12 uppercase" placeholder="e.g. MIPC-2026-00125" autoComplete="username" maxLength={40} required />
                  <p className="mt-1.5 text-xs leading-5 text-ink-500">Enter the registration number issued to you by MIPC.</p>
                </div>

                <div>
                  <label htmlFor="email" className="mipc-label">Registered email address</label>
                  <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mipc-field !min-h-12" placeholder="your@email.com" autoComplete="email" maxLength={320} required />
                  <p className="mt-1.5 text-xs leading-5 text-ink-500">The login code will be sent to this email address.</p>
                </div>

                <button type="submit" disabled={status === 'sending'} className="mipc-button-primary w-full !min-h-12 !bg-mipc-green-700 hover:!bg-mipc-green-800">
                  {status === 'sending' ? 'Checking your details…' : 'Send login code'}
                  {status !== 'sending' && <ChevronRightIcon className="h-4 w-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="mt-7 space-y-5">
                <div className="flex items-start gap-3 rounded-xl bg-mipc-green-50 p-4 text-sm leading-6 text-mipc-green-900">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-mipc-green-700" />
                  <p>We sent a one-time login code to <strong>{email}</strong>. Enter it below to continue.</p>
                </div>

                <div>
                  <label htmlFor="code" className="mipc-label">6-digit login code</label>
                  <input id="code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mipc-field !min-h-14 text-center font-mono text-2xl font-bold tracking-[0.35em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" required />
                </div>

                <button type="submit" disabled={status === 'verifying' || code.length !== 6} className="mipc-button-primary w-full !min-h-12 !bg-mipc-green-700 hover:!bg-mipc-green-800">
                  {status === 'verifying' ? 'Verifying code…' : 'Enter campus portal'}
                  {status !== 'verifying' && <ChevronRightIcon className="h-4 w-4" />}
                </button>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <button type="button" onClick={startAgain} className="font-semibold text-ink-600 hover:text-mipc-navy-950">Change details</button>
                  <button type="button" onClick={sendCode} disabled={status === 'sending'} className="font-bold text-mipc-green-700 hover:text-mipc-green-800 disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Send a new code'}</button>
                </div>
              </form>
            )}

            {status === 'error' && message && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger/20 bg-signal-danger-bg p-3 text-sm leading-5 text-signal-danger">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div className="mt-7 border-t border-mipc-navy-900/10 pt-5 text-center text-xs leading-5 text-ink-500">
              Having trouble signing in? Contact the MIPC Academic Registrar to confirm the email attached to your registration number.
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-ink-500"><Link href="/" className="font-semibold hover:text-mipc-navy-950">← Return to MIPC website</Link></p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f4f7f5] text-sm text-ink-500">Loading campus portal…</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
