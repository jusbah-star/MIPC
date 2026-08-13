'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, ChevronRightIcon, ShieldCheckIcon } from '@/components/icons';

const programmes = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    label: 'B-Tech Construction Technology',
    faculty: 'Engineering Technology',
    detail: 'Practical construction, site, materials and project skills.'
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    label: 'B-Tech Hospitality Management',
    faculty: 'Hospitality & Tourism',
    detail: 'Guest experience, service operations and hospitality leadership.'
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    label: 'B-Tech Travel & Tourism Management',
    faculty: 'Hospitality & Tourism',
    detail: 'Tourism operations, destination services and visitor experience.'
  },
  {
    id: 'b1000000-0000-4000-8000-000000000003',
    label: 'ICT / Advanced Diploma pathway',
    faculty: 'Information & Communication Technology',
    detail: 'Digital systems, networks and applied information technology.'
  },
  {
    id: 'b1000000-0000-4000-8000-000000000004',
    label: 'Technical Secondary School / TVET',
    faculty: 'Technical Education',
    detail: 'Hands-on technical and vocational skills for employment.'
  }
];

const steps = ['Your details', 'Programme', 'Motivation', 'Review'];

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  programmeLabel: string;
  statement: string;
  privacyConsent: boolean;
};

const initialValues: FormValues = {
  fullName: '',
  email: '',
  phone: '',
  departmentId: '',
  programmeLabel: '',
  statement: '',
  privacyConsent: false
};

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'done' | 'error'; message?: string; reference?: string }>({ status: 'idle' });

  const progress = useMemo(() => `${((step + 1) / steps.length) * 100}%`, [step]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (state.status === 'error') setState({ status: 'idle' });
  }

  function canContinue() {
    if (step === 0) return values.fullName.trim().length >= 2 && /\S+@\S+\.\S+/.test(values.email);
    if (step === 1) return Boolean(values.departmentId && values.programmeLabel);
    return true;
  }

  function next() {
    if (!canContinue()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!values.privacyConsent || state.status === 'saving') return;
    setState({ status: 'saving' });

    try {
      const response = await fetch('/api/admissions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          departmentId: values.departmentId,
          statement: values.statement.trim(),
          website: '',
          privacyConsent: values.privacyConsent
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState({ status: 'error', message: payload.error || 'We could not record your application. Please try again.' });
        return;
      }
      setState({ status: 'done', reference: payload.reference });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setState({ status: 'error', message: 'We could not connect to admissions. Check your connection and try again.' });
    }
  }

  if (state.status === 'done') {
    return (
      <div className="bg-[#f7f8f5] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-mipc-navy-900/10 bg-white shadow-academic-lg">
          <div className="h-2 bg-gradient-to-r from-mipc-navy-900 via-mipc-green-700 to-mipc-green-500" />
          <div className="p-7 text-center sm:p-12">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mipc-green-50 text-mipc-green-700 ring-8 ring-mipc-green-50/70">
              <CheckCircleIcon className="h-10 w-10" />
            </span>
            <p className="mipc-eyebrow mt-8 !text-mipc-green-700">Application received</p>
            <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight text-mipc-navy-950 sm:text-5xl">Thank you for applying to MIPC.</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink-600">Your application has been recorded. Save the private reference below together with the email address you used to apply.</p>

            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-mipc-navy-900/10 bg-mipc-navy-50/70 p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mipc-green-700">Application reference</p>
              <p className="mt-2 break-all font-mono text-base font-bold text-mipc-navy-950 sm:text-lg">{state.reference}</p>
              <p className="mt-3 text-xs leading-5 text-ink-600">Keep this reference private. MIPC will use the contact details you submitted if the admissions team needs more information.</p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/admissions/status" className="mipc-button-primary !bg-mipc-green-700">Track application <ChevronRightIcon className="h-4 w-4" /></Link>
              <Link href="/" className="mipc-button-secondary">Return to homepage</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f8f5]">
      <section className="border-b border-mipc-navy-900/10 bg-mipc-navy-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-mipc-green-300">Admissions 2026/2027</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Apply to MIPC</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">A simple, secure application for practical programmes in engineering, hospitality, tourism, ICT and technical education.</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[1.5rem] border border-mipc-navy-900/10 bg-white p-5 shadow-academic sm:p-6">
              <div className="mb-5 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
                <span>Application progress</span><span>{step + 1} of {steps.length}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-mipc-navy-50"><div className="h-full rounded-full bg-mipc-green-700 transition-all duration-300" style={{ width: progress }} /></div>
              <div className="mt-6 grid gap-1">
                {steps.map((label, index) => {
                  const active = index === step;
                  const complete = index < step;
                  return (
                    <button key={label} type="button" onClick={() => complete && setStep(index)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-mipc-navy-950 text-white' : complete ? 'text-mipc-green-800 hover:bg-mipc-green-50' : 'cursor-default text-ink-500'}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? 'bg-mipc-green-600 text-white' : complete ? 'bg-mipc-green-100 text-mipc-green-800' : 'bg-mipc-navy-50 text-ink-500'}`}>{complete ? '✓' : index + 1}</span>
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-mipc-green-50 p-5 sm:p-6">
              <ShieldCheckIcon className="h-6 w-6 text-mipc-green-700" />
              <h2 className="mt-3 text-base font-bold text-mipc-navy-950">Your information stays protected.</h2>
              <p className="mt-2 text-sm leading-6 text-ink-600">MIPC uses your application information for admissions administration and decision-making.</p>
              <Link href="/privacy" className="mt-3 inline-flex text-sm font-bold text-mipc-green-700 underline">Read the privacy notice</Link>
            </div>
          </aside>

          <main>
            <div className="overflow-hidden rounded-[1.75rem] border border-mipc-navy-900/10 bg-white shadow-academic-lg">
              <div className="border-b border-mipc-navy-900/10 px-6 py-6 sm:px-9 sm:py-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-mipc-green-700">Step {step + 1}</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-mipc-navy-950">
                  {step === 0 && 'Tell us who you are'}
                  {step === 1 && 'Choose your programme'}
                  {step === 2 && 'Tell us what motivates you'}
                  {step === 3 && 'Review your application'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  {step === 0 && 'Use your legal name and an email address you can access throughout the admissions process.'}
                  {step === 1 && 'Select the MIPC pathway you want the admissions team to consider.'}
                  {step === 2 && 'A short statement helps the admissions team understand your interests and goals.'}
                  {step === 3 && 'Check the details below before submitting. You can go back to make changes.'}
                </p>
              </div>

              <div className="p-6 sm:p-9">
                {step === 0 && (
                  <div className="grid gap-6">
                    <div>
                      <label className="mipc-label" htmlFor="fullName">Full legal name <span className="text-signal-danger">*</span></label>
                      <input className="mipc-field" id="fullName" value={values.fullName} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" maxLength={160} placeholder="As it appears on your identification" />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mipc-label" htmlFor="email">Email address <span className="text-signal-danger">*</span></label>
                        <input className="mipc-field" id="email" value={values.email} onChange={(e) => update('email', e.target.value)} type="email" autoComplete="email" maxLength={320} placeholder="you@example.com" />
                      </div>
                      <div>
                        <label className="mipc-label" htmlFor="phone">Phone number</label>
                        <input className="mipc-field" id="phone" value={values.phone} onChange={(e) => update('phone', e.target.value)} type="tel" autoComplete="tel" maxLength={32} placeholder="+250 7XX XXX XXX" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-mipc-navy-900/10 bg-mipc-navy-50/55 p-4 text-sm leading-6 text-ink-600">Use an email address you check regularly. You will need the same address later when tracking your application.</div>
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {programmes.map((programme, index) => {
                      const selected = values.departmentId === programme.id && values.programmeLabel === programme.label;
                      return (
                        <button key={`${programme.id}-${index}`} type="button" onClick={() => setValues((current) => ({ ...current, departmentId: programme.id, programmeLabel: programme.label }))} className={`group rounded-[1.25rem] border p-5 text-left transition ${selected ? 'border-mipc-green-700 bg-mipc-green-50 ring-2 ring-mipc-green-700/10' : 'border-mipc-navy-900/10 bg-white hover:-translate-y-0.5 hover:border-mipc-green-700/40 hover:shadow-academic'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-mipc-green-700">{programme.faculty}</span>
                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${selected ? 'border-mipc-green-700 bg-mipc-green-700 text-white' : 'border-mipc-navy-900/20 text-transparent'}`}>✓</span>
                          </div>
                          <h3 className="mt-4 text-xl font-bold leading-snug text-mipc-navy-950">{programme.label}</h3>
                          <p className="mt-2 text-sm leading-6 text-ink-600">{programme.detail}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <label className="mipc-label" htmlFor="statement">Statement of purpose <span className="font-normal text-ink-500">(optional)</span></label>
                    <textarea className="mipc-field min-h-64 resize-y" id="statement" value={values.statement} onChange={(e) => update('statement', e.target.value)} maxLength={5000} placeholder="Tell us about your education, what interests you about this programme, and what you hope to do after your studies." />
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-500"><span>Write naturally — a few clear paragraphs are enough.</span><span>{values.statement.length.toLocaleString()} / 5,000</span></div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-6">
                    <div className="grid gap-px overflow-hidden rounded-2xl border border-mipc-navy-900/10 bg-mipc-navy-900/10">
                      {[
                        ['Full legal name', values.fullName],
                        ['Email address', values.email],
                        ['Phone number', values.phone || 'Not provided'],
                        ['Programme', values.programmeLabel]
                      ].map(([label, value]) => <div key={label} className="grid gap-1 bg-white px-5 py-4 sm:grid-cols-[180px_1fr] sm:items-center"><span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">{label}</span><span className="text-sm font-semibold text-mipc-navy-950">{value}</span></div>)}
                    </div>

                    <div className="rounded-2xl border border-mipc-navy-900/10 bg-white p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Statement of purpose</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-700">{values.statement.trim() || 'No statement provided.'}</p>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-mipc-green-700/20 bg-mipc-green-50 p-5 text-sm leading-6 text-ink-700">
                      <input className="mt-1 h-5 w-5 shrink-0 accent-mipc-green-700" type="checkbox" checked={values.privacyConsent} onChange={(e) => update('privacyConsent', e.target.checked)} />
                      <span>I have read the <Link href="/privacy" className="font-bold text-mipc-green-700 underline">privacy notice</Link> and acknowledge that MIPC will process this information for admission administration. <span className="text-signal-danger">*</span></span>
                    </label>

                    {state.status === 'error' && <p role="alert" className="rounded-xl bg-signal-danger-bg p-4 text-sm font-medium text-signal-danger">{state.message}</p>}
                  </div>
                )}

                <div className="mt-9 flex flex-col-reverse gap-3 border-t border-mipc-navy-900/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>{step > 0 && <button type="button" onClick={back} className="mipc-button-secondary w-full sm:w-auto">Back</button>}</div>
                  {step < steps.length - 1 ? (
                    <button type="button" onClick={next} disabled={!canContinue()} className="mipc-button-primary w-full !bg-mipc-green-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">Continue <ChevronRightIcon className="h-4 w-4" /></button>
                  ) : (
                    <button type="button" onClick={submit} disabled={!values.privacyConsent || state.status === 'saving'} className="mipc-button-primary w-full !bg-mipc-green-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">{state.status === 'saving' ? 'Submitting application…' : 'Submit application securely'} <ChevronRightIcon className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 text-center text-xs leading-5 text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <span>Need to check an application you already submitted?</span>
              <Link href="/admissions/status" className="font-bold text-mipc-green-700">Track your application →</Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
