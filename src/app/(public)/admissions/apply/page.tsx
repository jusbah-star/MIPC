'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, ChevronRightIcon, ShieldCheckIcon } from '@/components/icons';

const programmes = [
  { id: 'b1000000-0000-4000-8000-000000000001', label: 'B‑Tech Construction Technology' },
  { id: 'b1000000-0000-4000-8000-000000000002', label: 'B‑Tech Hospitality Management' },
  { id: 'b1000000-0000-4000-8000-000000000002', label: 'B‑Tech Travel & Tourism Management' },
  { id: 'b1000000-0000-4000-8000-000000000003', label: 'ICT / Advanced Diploma pathway' },
  { id: 'b1000000-0000-4000-8000-000000000004', label: 'Technical Secondary School / TVET' }
];

const steps = [
  ['01', 'Tell us about yourself', 'Basic contact and identity information.'],
  ['02', 'Choose your pathway', 'Select the programme you want to pursue.'],
  ['03', 'Submit securely', 'Receive a private reference for tracking.']
];

export default function ApplyPage() {
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'done' | 'error'; message?: string; reference?: string }>({ status: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'saving' });
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: form.get('fullName'),
        email: form.get('email'),
        phone: form.get('phone'),
        departmentId: form.get('departmentId'),
        statement: form.get('statement'),
        website: form.get('website'),
        privacyConsent: form.get('privacyConsent') === 'on'
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ status: 'error', message: payload.error || 'We could not record your application.' });
    setState({ status: 'done', reference: payload.reference });
  }

  if (state.status === 'done') {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="rounded-3xl border border-mipc-green-700/10 bg-white p-7 text-center shadow-academic-lg sm:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mipc-green-50 text-mipc-green-700">
            <CheckCircleIcon className="h-7 w-7" />
          </span>
          <p className="mipc-eyebrow mt-7 justify-center">Application received</p>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">You&apos;re officially in the process.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-600">Save this private reference. You&apos;ll use it with your email address to check the progress of your application.</p>
          <div className="mx-auto mt-7 max-w-md rounded-2xl border border-ink-900/[0.08] bg-parchment-100 px-5 py-4 text-base font-bold tracking-wide text-ink-950">
            {state.reference}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/admissions/status" className="mipc-button-primary">Track application <ChevronRightIcon className="h-4 w-4" /></Link>
            <Link href="/" className="mipc-button-secondary">Return home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="mipc-eyebrow">Admissions 2026/2027</p>
          <h1 className="mt-4 max-w-lg font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-5xl">Take the first step toward MIPC.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-600">A simple online application for MIPC&apos;s practical higher-education and TVET pathways.</p>

          <div className="mt-9 space-y-5 border-l border-ink-900/[0.09] pl-5">
            {steps.map(([number, title, description]) => (
              <div key={number} className="relative">
                <span className="absolute -left-[2.05rem] top-0 grid h-6 w-6 place-items-center rounded-full bg-mipc-green-900 text-[9px] font-bold text-white">{number}</span>
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 rounded-2xl border border-mipc-green-700/10 bg-mipc-green-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-mipc-green-700" />
              <div>
                <p className="text-sm font-semibold text-ink-950">Your information is handled carefully</p>
                <p className="mt-1 text-xs leading-5 text-ink-600">MIPC uses these details only for admission administration and communication. Review the <Link className="font-semibold text-mipc-green-700 underline underline-offset-2" href="/privacy">privacy notice</Link>.</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8 lg:p-10">
          <div className="border-b border-ink-900/[0.07] pb-6">
            <p className="text-xs font-semibold text-mipc-green-700">Application form</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">Applicant details</h2>
            <p className="mt-2 text-sm text-ink-500">Fields marked with * are required.</p>
          </div>

          <form onSubmit={submit} className="mt-7 grid gap-6">
            <div>
              <label className="mipc-label" htmlFor="fullName">Full legal name *</label>
              <input className="mipc-field" id="fullName" name="fullName" autoComplete="name" maxLength={160} required placeholder="Your name as it appears on official documents" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mipc-label" htmlFor="email">Email address *</label>
                <input className="mipc-field" id="email" name="email" type="email" autoComplete="email" maxLength={320} required placeholder="name@example.com" />
              </div>
              <div>
                <label className="mipc-label" htmlFor="phone">Phone number</label>
                <input className="mipc-field" id="phone" name="phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+250 7xx xxx xxx" />
              </div>
            </div>

            <div>
              <label className="mipc-label" htmlFor="departmentId">Programme pathway *</label>
              <select className="mipc-field" id="departmentId" name="departmentId" required defaultValue="">
                <option value="" disabled>Select a programme</option>
                {programmes.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{item.label}</option>)}
              </select>
            </div>

            <div>
              <label className="mipc-label" htmlFor="statement">Statement of purpose</label>
              <textarea className="mipc-field min-h-40" id="statement" name="statement" maxLength={5000} placeholder="Tell us briefly about your education, interests and what you hope to achieve at MIPC." />
              <p className="mt-2 text-xs text-ink-400">Up to 5,000 characters.</p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-ink-900/[0.08] bg-parchment-50 p-4 text-sm leading-6 text-ink-600">
              <input className="mt-1 h-4 w-4 shrink-0 accent-mipc-green-700" type="checkbox" name="privacyConsent" required />
              <span>I have read the <Link href="/privacy" className="font-semibold text-mipc-green-700 underline underline-offset-2">privacy notice</Link> and acknowledge that MIPC will process this information for admission administration. *</span>
            </label>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="flex flex-col gap-3 border-t border-ink-900/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-ink-400">You&apos;ll receive a private reference after submission.</p>
              <button className="mipc-button-primary min-w-44" disabled={state.status === 'saving'}>
                {state.status === 'saving' ? 'Submitting…' : 'Submit application'}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            {state.status === 'error' ? <p role="alert" className="rounded-xl bg-signal-danger-bg p-4 text-sm text-signal-danger">{state.message}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
