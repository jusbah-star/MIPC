'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircleIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';

export default function AdmissionsStatusPage() {
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || !email.trim()) return;

    setSearched(true);
    setError('');
    const response = await fetch('/api/admissions/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: query.trim(), email: email.trim() })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setResult(null);
      setError(payload.error || 'Status is temporarily unavailable.');
      return;
    }
    setResult(payload.application ?? null);
  };

  const statusConfig = result
    ? result.status === 'approved'
      ? { label: 'Admitted', detail: 'Your application has been approved.', tone: 'success' as const }
      : result.status === 'rejected'
        ? { label: 'Decision complete', detail: 'Your application was not approved.', tone: 'danger' as const }
        : { label: 'Under review', detail: 'The admissions team is reviewing your application.', tone: 'pending' as const }
    : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16">
        <aside>
          <p className="mipc-eyebrow">Application tracking</p>
          <h1 className="mt-4 max-w-lg font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-5xl">Know where your application stands.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-600">Use the private reference issued after submission together with the same email address you applied with.</p>

          <div className="mt-8 rounded-2xl border border-ink-900/[0.08] bg-white p-5 shadow-xs">
            <p className="text-sm font-semibold text-ink-950">What you&apos;ll need</p>
            <div className="mt-4 space-y-3 text-sm text-ink-600">
              <div className="flex gap-3"><span className="font-semibold text-mipc-green-700">01</span><span>Your complete private application reference</span></div>
              <div className="flex gap-3"><span className="font-semibold text-mipc-green-700">02</span><span>The email address used on the application</span></div>
            </div>
          </div>

          <p className="mt-5 text-xs leading-5 text-ink-400">For your privacy, MIPC requires both pieces of information before showing an admission record.</p>
        </aside>

        <section className="rounded-3xl border border-ink-900/[0.08] bg-white p-6 shadow-academic sm:p-8 lg:p-10">
          <div className="border-b border-ink-900/[0.07] pb-6">
            <p className="text-xs font-semibold text-mipc-green-700">Admissions tracker</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">Check your status</h2>
            <p className="mt-2 text-sm text-ink-500">Enter the exact details from your submitted application.</p>
          </div>

          <form onSubmit={handleSearch} className="mt-7 space-y-5">
            <div>
              <label htmlFor="reference" className="mipc-label">Application reference</label>
              <input
                id="reference"
                required
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Paste your complete private reference"
                className="mipc-input min-h-12"
              />
            </div>
            <div>
              <label htmlFor="applicationEmail" className="mipc-label">Application email</label>
              <input
                id="applicationEmail"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="name@example.com"
                className="mipc-input min-h-12"
              />
            </div>

            <button type="submit" className="mipc-button-primary min-h-12 w-full">
              Check application status <ChevronRightIcon className="h-4 w-4" />
            </button>
          </form>

          {error ? <p role="alert" className="mt-6 rounded-2xl bg-signal-danger-bg p-4 text-sm leading-6 text-signal-danger">{error}</p> : null}

          {searched && !error ? (
            <div className="mt-8 border-t border-ink-900/[0.07] pt-7">
              {result && statusConfig ? (
                <div className="overflow-hidden rounded-2xl border border-ink-900/[0.08] bg-parchment-50">
                  <div className="flex flex-col gap-4 border-b border-ink-900/[0.07] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ink-400">Application #{result.id.slice(-6).toUpperCase()}</p>
                      <h3 className="mt-1 text-lg font-bold text-ink-950">{result.full_name}</h3>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      statusConfig.tone === 'success'
                        ? 'bg-signal-ok-bg text-signal-ok'
                        : statusConfig.tone === 'danger'
                          ? 'bg-signal-danger-bg text-signal-danger'
                          : 'bg-signal-warn-bg text-signal-warn'
                    }`}>
                      {statusConfig.tone === 'success' ? <CheckCircleIcon className="h-3.5 w-3.5" /> : statusConfig.tone === 'pending' ? <ClockIcon className="h-3.5 w-3.5" /> : null}
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-sm leading-6 text-ink-600">{statusConfig.detail}</p>
                    <dl className="mt-5 grid gap-4 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-medium text-ink-400">Submitted</dt>
                        <dd className="mt-1 font-semibold text-ink-900">{new Date(result.submitted_at).toLocaleDateString('en-RW', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-ink-400">Campus</dt>
                        <dd className="mt-1 font-semibold text-ink-900">MIPC Musanze</dd>
                      </div>
                    </dl>

                    {result.status === 'approved' ? (
                      <div className="mt-5 rounded-xl bg-signal-ok-bg p-4 text-sm leading-6 text-signal-ok">
                        Formal acceptance has been granted. Follow the registrar&apos;s instructions to complete matriculation.
                      </div>
                    ) : null}

                    {result.status === 'approved' ? (
                      <Link href="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-900">
                        Continue to student portal <ChevronRightIcon className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-signal-warn/15 bg-signal-warn-bg p-5 text-signal-warn">
                  <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">We couldn&apos;t find a matching application</p>
                    <p className="mt-1 text-xs leading-5">Check that both the full reference and email address exactly match the original application.</p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
