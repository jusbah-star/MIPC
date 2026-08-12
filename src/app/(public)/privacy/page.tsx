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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setResult({ state: 'error', message: payload.error || 'Your request could not be sent.' });
    setResult({ state: 'done', message: `Request received. Reference: ${payload.reference}` });
    event.currentTarget.reset();
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <div>
          <p className="mipc-eyebrow">Privacy & data rights</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Your information should be treated with the same care as your academic record.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-600">
            MIPC&apos;s digital campus is designed to support responsible handling of student, applicant and staff information, with role-based access and clear ways to exercise your data rights.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {rights.map(([title, text], index) => (
              <article key={title} className="rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between gap-4">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-mipc-green-50 text-mipc-green-700">
                    <CheckCircleIcon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold text-ink-300">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h2 className="mt-5 text-base font-bold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-mipc-green-950 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-mipc-green-300">
                <ShieldCheckIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-[-0.025em] text-white">How the platform protects academic records</h2>
                <div className="mt-5 grid gap-3 text-sm leading-6 text-white/65 sm:grid-cols-2">
                  <p>Role-based access is enforced at the database layer.</p>
                  <p>Examination timing and scoring remain server-authoritative.</p>
                  <p>Sensitive academic actions create auditable records.</p>
                  <p>Admissions tracking reveals only the minimum necessary information.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-xs leading-5 text-ink-500">
            The platform supports MIPC&apos;s privacy operations. Official guidance is available from the{' '}
            <a className="font-semibold text-mipc-green-700 underline underline-offset-2" href="https://dpo.gov.rw/dpp-law/rights-of-the-data-subject" target="_blank" rel="noreferrer">Rwanda Data Protection Office</a>{' '}
            and the{' '}
            <a className="font-semibold text-mipc-green-700 underline underline-offset-2" href="https://www.hec.gov.rw/publications/policies" target="_blank" rel="noreferrer">Higher Education Council</a>.
          </p>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic-lg sm:p-8">
            <p className="text-xs font-semibold text-mipc-green-700">Exercise a data right</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em]">Send a request to MIPC</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Provide enough detail for the college to understand the request. Identity verification may be required before records are released or changed.</p>

            <form onSubmit={submit} className="mt-7 grid gap-5">
              <div>
                <label className="mipc-label" htmlFor="requestType">Request type</label>
                <select className="mipc-field" id="requestType" name="requestType" required defaultValue="access">
                  <option value="access">Access my data</option>
                  <option value="rectification">Correct my data</option>
                  <option value="restriction">Restrict processing</option>
                  <option value="erasure">Erase eligible data</option>
                  <option value="portability">Receive a portable copy</option>
                  <option value="objection">Object to processing</option>
                </select>
              </div>
              <div>
                <label className="mipc-label" htmlFor="fullName">Full name</label>
                <input className="mipc-field" id="fullName" name="fullName" autoComplete="name" maxLength={160} required placeholder="Your full name" />
              </div>
              <div>
                <label className="mipc-label" htmlFor="email">Email used with MIPC</label>
                <input className="mipc-field" id="email" name="email" type="email" autoComplete="email" maxLength={320} required placeholder="name@example.com" />
              </div>
              <div>
                <label className="mipc-label" htmlFor="details">What would you like MIPC to do?</label>
                <textarea className="mipc-field min-h-36" id="details" name="details" minLength={10} maxLength={5000} required placeholder="Describe the information or change you are requesting." />
              </div>
              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <button className="mipc-button-primary min-h-12 w-full" disabled={result.state === 'saving'}>
                {result.state === 'saving' ? 'Sending request…' : 'Submit privacy request'}
              </button>
              {result.message ? (
                <p role="status" className={`rounded-xl p-4 text-sm leading-6 ${result.state === 'done' ? 'bg-signal-ok-bg text-signal-ok' : 'bg-signal-danger-bg text-signal-danger'}`}>
                  {result.message}
                </p>
              ) : null}
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
