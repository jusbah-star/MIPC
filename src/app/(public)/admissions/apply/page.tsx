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

export default function ApplyPage() {
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'done' | 'error'; message?: string; reference?: string }>({ status: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'saving' });
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admissions/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: form.get('fullName'), email: form.get('email'), phone: form.get('phone'),
        departmentId: form.get('departmentId'), statement: form.get('statement'), website: form.get('website'),
        privacyConsent: form.get('privacyConsent') === 'on'
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ status: 'error', message: payload.error || 'We could not record your application.' });
    setState({ status: 'done', reference: payload.reference });
  }

  if (state.status === 'done') return (
    <div className="mx-auto max-w-2xl px-5 py-20 sm:px-8">
      <div className="mipc-card p-8 text-center sm:p-12"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-signal-ok-bg text-signal-ok"><CheckCircleIcon className="h-9 w-9" /></span><p className="mipc-eyebrow mt-6">Application received</p><h1 className="mt-2 text-4xl font-bold">Your MIPC journey starts here.</h1><p className="mt-4 text-ink-700">Keep this private reference together with your email address. You will need both to check your application.</p><div className="mt-7 rounded-xl bg-parchment-100 p-4 font-mono text-sm font-bold tracking-wide text-ink-950">{state.reference}</div><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/admissions/status" className="mipc-button-primary">Track application <ChevronRightIcon className="h-4 w-4" /></Link><Link href="/" className="mipc-button-secondary">Return home</Link></div></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
        <aside>
          <p className="mipc-eyebrow">Admissions 2026/2027</p><h1 className="mt-3 text-5xl font-bold tracking-tight">Build your future at MIPC.</h1><p className="mt-5 text-lg leading-8 text-ink-700">Apply for a practical programme in engineering technology, hospitality, tourism, ICT or TVET education.</p>
          <div className="mt-8 grid gap-4">{['Complete this secure application', 'Receive a private reference', 'Track review with reference + email', 'Receive the official decision from MIPC'].map((item, index) => <div key={item} className="flex items-center gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mipc-green-800 text-sm font-bold text-white">{index + 1}</span><span className="text-sm font-semibold text-ink-800">{item}</span></div>)}</div>
          <div className="mt-8 rounded-2xl bg-mipc-green-50 p-5"><ShieldCheckIcon className="h-6 w-6 text-mipc-green-700" /><p className="mt-3 text-sm leading-6 text-ink-700">MIPC uses this information to assess admission and communicate your application outcome. Read the <Link className="font-bold text-mipc-green-700 underline" href="/privacy">privacy and data-rights notice</Link>.</p></div>
        </aside>
        <div className="mipc-card p-6 sm:p-9">
          <h2 className="text-3xl font-bold">Applicant details</h2><p className="mt-2 text-sm text-ink-600">Fields marked required must be completed.</p>
          <form onSubmit={submit} className="mt-8 grid gap-6">
            <div><label className="mipc-label" htmlFor="fullName">Full legal name *</label><input className="mipc-field" id="fullName" name="fullName" autoComplete="name" maxLength={160} required /></div>
            <div className="grid gap-5 sm:grid-cols-2"><div><label className="mipc-label" htmlFor="email">Email address *</label><input className="mipc-field" id="email" name="email" type="email" autoComplete="email" maxLength={320} required /></div><div><label className="mipc-label" htmlFor="phone">Phone number</label><input className="mipc-field" id="phone" name="phone" type="tel" autoComplete="tel" maxLength={32} placeholder="+250 …" /></div></div>
            <div><label className="mipc-label" htmlFor="departmentId">Programme pathway *</label><select className="mipc-field" id="departmentId" name="departmentId" required defaultValue=""><option value="" disabled>Select a programme</option>{programmes.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{item.label}</option>)}</select></div>
            <div><label className="mipc-label" htmlFor="statement">Statement of purpose</label><textarea className="mipc-field min-h-40" id="statement" name="statement" maxLength={5000} placeholder="Tell the admissions team about your education, interests and goals." /><p className="mt-1.5 text-xs text-ink-500">Maximum 5,000 characters.</p></div>
            <label className="flex items-start gap-3 rounded-xl border border-ink-900/10 bg-parchment-50 p-4 text-sm leading-6 text-ink-700"><input className="mt-1 h-5 w-5 shrink-0 accent-mipc-green-700" type="checkbox" name="privacyConsent" required /><span>I have read the <Link href="/privacy" className="font-bold text-mipc-green-700 underline">privacy notice</Link> and acknowledge that MIPC will process this information for admission administration. *</span></label>
            <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
            <button className="mipc-button-primary w-full sm:w-auto sm:justify-self-start" disabled={state.status === 'saving'}>{state.status === 'saving' ? 'Recording application…' : 'Submit application securely'} <ChevronRightIcon className="h-4 w-4" /></button>
            {state.status === 'error' && <p role="alert" className="rounded-xl bg-signal-danger-bg p-4 text-sm text-signal-danger">{state.message}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
