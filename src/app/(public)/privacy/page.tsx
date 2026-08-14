'use client';

import { useState } from 'react';
import { CheckCircleIcon, ShieldCheckIcon } from '@/components/icons';

const rights = [
  ['Access', 'Ask what personal data MIPC holds and why it is processed.'],
  ['Rectification', 'Ask for inaccurate or incomplete personal data to be corrected.'],
  ['Restriction or objection', 'Ask MIPC to restrict or stop eligible processing.'],
  ['Erasure', 'Ask for eligible data to be deleted when it is no longer required.'],
  ['Portability', 'Request eligible data in a structured, readable format.'],
  ['Human review', 'Ask for human review where an important decision used automated processing.']
];

export default function PrivacyPage() {
  const [result, setResult] = useState<{ state: 'idle' | 'saving' | 'done' | 'error'; message?: string }>({ state: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ state: 'saving' });
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/privacy/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setResult({ state: 'error', message: payload.error || 'Your request could not be sent.' });
    setResult({ state: 'done', message: `Request received. Reference: ${payload.reference}` });
    event.currentTarget.reset();
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1fr_.8fr]">
        <div>
          <p className="mipc-eyebrow">Privacy & trust</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-bold tracking-tight">Your academic journey deserves responsible data care.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-700">This digital campus is designed around Rwanda’s Law Nº 058/2021 relating to the protection of personal data and privacy. MIPC should publish its final controller registration details, retention schedule and appointed data protection contact before production launch.</p>

          <div className="mt-8 rounded-2xl border border-mipc-navy-900/10 bg-[#f7f8f5] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-mipc-green-700">Admissions evidence</p>
            <h2 className="mt-2 text-xl font-bold text-mipc-navy-950">What an applicant provides</h2>
            <p className="mt-2 text-sm leading-6 text-ink-700">For admissions, MIPC may collect identity/contact details, the programme requested, the applicant’s secondary-school field or combination, national-examination result, statement of purpose and a copy of the secondary diploma. These records are used to review eligibility, make an admissions decision and complete registration when the applicant is accepted.</p>
            <p className="mt-3 text-sm leading-6 text-ink-700">Diploma files are stored privately. Only authorized admissions staff such as the Registrar and Principal/Administrator can request a short-lived review link through the portal.</p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">{rights.map(([title, text]) => <div key={title} className="mipc-card p-5"><CheckCircleIcon className="h-5 w-5 text-mipc-green-700" /><h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-ink-700">{text}</p></div>)}</div>
          <div className="mt-10 rounded-2xl bg-mipc-green-950 p-7 text-white"><ShieldCheckIcon className="h-8 w-8 text-brass-300" /><h2 className="mt-4 text-2xl font-bold">How this platform protects records</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-white/75"><li>Role-based access enforced in the database.</li><li>Private admissions document storage with temporary review links.</li><li>Server-authoritative examination timing and scoring.</li><li>Append-only audit events for sensitive academic actions.</li><li>Minimum necessary information shown in admissions tracking.</li></ul></div>
          <p className="mt-6 text-xs leading-5 text-ink-600">Official guidance: <a className="font-semibold text-mipc-green-700 underline" href="https://dpo.gov.rw/dpp-law/rights-of-the-data-subject" target="_blank" rel="noreferrer">Rwanda DPO data-subject rights</a> and <a className="font-semibold text-mipc-green-700 underline" href="https://www.hec.gov.rw/publications/policies" target="_blank" rel="noreferrer">HEC policies</a>. This page supports compliance operations; it is not legal certification.</p>
        </div>

        <div className="mipc-card h-fit p-6 sm:p-8">
          <p className="mipc-eyebrow">Exercise a data right</p><h2 className="mt-2 text-3xl font-bold">Send a request to MIPC</h2><p className="mt-3 text-sm leading-6 text-ink-700">MIPC must verify identity before releasing or changing personal data. Rwanda’s DPP law generally provides a 30-day response window for these requests.</p>
          <form onSubmit={submit} className="mt-7 grid gap-5">
            <div><label className="mipc-label" htmlFor="requestType">Request type</label><select className="mipc-field" id="requestType" name="requestType" required defaultValue="access"><option value="access">Access my data</option><option value="rectification">Correct my data</option><option value="restriction">Restrict processing</option><option value="erasure">Erase eligible data</option><option value="portability">Receive a portable copy</option><option value="objection">Object to processing</option></select></div>
            <div><label className="mipc-label" htmlFor="fullName">Full name</label><input className="mipc-field" id="fullName" name="fullName" autoComplete="name" maxLength={160} required /></div>
            <div><label className="mipc-label" htmlFor="email">Email used with MIPC</label><input className="mipc-field" id="email" name="email" type="email" autoComplete="email" maxLength={320} required /></div>
            <div><label className="mipc-label" htmlFor="details">What would you like MIPC to do?</label><textarea className="mipc-field min-h-36" id="details" name="details" minLength={10} maxLength={5000} required /></div>
            <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
            <button className="mipc-button-primary w-full" disabled={result.state === 'saving'}>{result.state === 'saving' ? 'Sending request…' : 'Submit privacy request'}</button>
            {result.message && <p role="status" className={`rounded-xl p-3 text-sm ${result.state === 'done' ? 'bg-signal-ok-bg text-signal-ok' : 'bg-signal-danger-bg text-signal-danger'}`}>{result.message}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
