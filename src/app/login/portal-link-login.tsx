'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheckIcon } from '@/components/icons';
import { GENERIC_SIGN_IN_MESSAGE } from '@/lib/auth-policy';
import type { LoginPortal } from '@/lib/roles';

type PortalRole = LoginPortal;

const portals: Array<{ role: PortalRole; label: string; short: string }> = [
  { role: 'student', label: 'Student', short: 'Student' },
  { role: 'staff', label: 'Staff', short: 'Staff' },
  { role: 'admin', label: 'Administrator', short: 'Admin' }
];

const copy: Record<PortalRole, { email: string; help: string }> = {
  student: { email: 'Registered email address', help: 'Use the email attached to your student registration number.' },
  staff: { email: 'Staff email address', help: 'Lecturers, HODs, Registrar and Finance staff use the email registered on their active MIPC account.' },
  admin: { email: 'Administrator / Principal email', help: 'Use the email registered on your active MIPC Principal or administrator account.' }
};

const linkErrors: Record<string, string> = {
  invalid_email_link: 'That sign-in link is incomplete or invalid. Request a new secure link below.',
  email_link_expired: 'That one-time sign-in link has expired or was already consumed. Request a fresh link below and use the newest email.',
  auth_failed: 'MIPC could not complete that sign-in link. Request a new secure link below.',
  account_unavailable: 'This account is not currently available for portal access.'
};

export function PortalLinkLogin() {
  const searchParams = useSearchParams();
  const [portal, setPortal] = useState<PortalRole>('student');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const linkError = linkErrors[searchParams.get('error') ?? ''] ?? '';

  function choosePortal(role: PortalRole) {
    if (busy) return;
    setPortal(role);
    setRegistrationNumber('');
    setEmail('');
    setSent(false);
    setError('');
  }

  async function sendLink(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal, email, ...(portal === 'student' ? { registrationNumber } : {}) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'We could not process this sign-in request.');
        return;
      }
      setSent(true);
    } catch {
      setError('We could not reach the sign-in service. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const selected = portals.find((item) => item.role === portal)!;

  return (
    <main className="min-h-screen bg-[#f4f7f5] lg:grid lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-mipc-navy-950 text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src="/api/campus-photo?name=hero" alt="MIPC campus" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,16,34,.96),rgba(6,16,34,.82)_52%,rgba(29,73,50,.78))]" />
        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white shadow-lg"><img src="/api/mipc-logo" alt="MIPC crest" className="h-full w-full object-contain p-1" /></span>
          <span><span className="block text-2xl font-bold">MIPC</span><span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Digital Campus</span></span>
        </Link>
        <div className="relative z-10 max-w-xl pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-mipc-green-300">Secure campus access</p>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.03] xl:text-6xl">The right portal,<br />one secure link away.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/72">Students verify their registration number and email. Lecturers, HODs, Registrar and Finance staff use the shared Staff entry. The stored role and active account status determine the workspace after sign-in.</p>
        </div>
        <p className="relative z-10 text-xs text-white/45">Muhabura Integrated Polytechnic College · Musanze, Rwanda</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="rounded-[1.75rem] border border-mipc-navy-900/10 bg-white p-6 shadow-academic sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-mipc-green-700">Campus portal</p><h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-mipc-navy-950">{sent ? 'Check your email' : 'Sign in to MIPC'}</h2></div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mipc-green-50 text-mipc-green-700"><ShieldCheckIcon className="h-5 w-5" /></span>
            </div>

            {linkError && !sent && <p className="mt-5 rounded-xl bg-signal-danger-bg p-3 text-sm leading-6 text-signal-danger">{linkError}</p>}

            <div className="mt-6 grid grid-cols-3 rounded-2xl bg-mipc-navy-950/[0.04] p-1" aria-label="Choose campus portal">
              {portals.map((item) => {
                const active = portal === item.role;
                return <button key={item.role} type="button" onClick={() => choosePortal(item.role)} disabled={busy} aria-pressed={active} className={`min-h-11 rounded-xl px-2 text-xs font-bold transition sm:text-[13px] ${active ? 'bg-white text-mipc-navy-950 shadow-sm ring-1 ring-mipc-navy-900/10' : 'text-ink-500 hover:text-mipc-navy-950'}`}><span className="hidden sm:inline">{item.label}</span><span className="sm:hidden">{item.short}</span></button>;
              })}
            </div>

            {!sent ? (
              <form onSubmit={sendLink} className="mt-7 space-y-5">
                {portal === 'student' && <div><label className="mipc-label">Registration number</label><input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} className="mipc-field !min-h-12 uppercase" placeholder="e.g. MIPC-2026-00125" maxLength={40} required /></div>}
                <div><label className="mipc-label">{copy[portal].email}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mipc-field !min-h-12" placeholder="your@email.com" maxLength={320} required /><p className="mt-1.5 text-xs leading-5 text-ink-500">{copy[portal].help}</p></div>
                <button disabled={busy} className="mipc-button-primary w-full !min-h-12 !bg-mipc-green-700">{busy ? 'Checking your details…' : 'Send secure sign-in link'}</button>
              </form>
            ) : (
              <div className="mt-7 space-y-5">
                <div className="rounded-xl bg-mipc-green-50 p-4 text-sm leading-6 text-mipc-green-900">
                  <strong>Request received.</strong><br />
                  {GENERIC_SIGN_IN_MESSAGE} If a message arrives at <strong>{email}</strong>, use the newest message and follow its one-time link through the <strong>{selected.label}</strong> entry.
                </div>
                <button type="button" onClick={() => setSent(false)} className="mipc-button-secondary w-full">Change sign-in details</button>
                <button type="button" onClick={() => void sendLink()} disabled={busy} className="w-full text-sm font-bold text-mipc-green-800">{busy ? 'Sending…' : 'Send another request'}</button>
              </div>
            )}

            {error && <p className="mt-5 rounded-xl bg-signal-danger-bg p-3 text-sm text-signal-danger">{error}</p>}
          </div>
          <p className="mt-6 text-center text-xs text-ink-500"><Link href="/" className="font-semibold hover:text-mipc-navy-950">← Return to MIPC website</Link></p>
        </div>
      </section>
    </main>
  );
}
