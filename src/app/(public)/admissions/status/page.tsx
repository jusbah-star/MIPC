'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  ChevronRightIcon
} from '@/components/icons';

export default function AdmissionsStatusPage() {
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [resend, setResend] = useState<{ state: 'idle' | 'sending' | 'done' | 'error'; message?: string }>({ state: 'idle' });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !email.trim()) return;

    setSearched(true);
    setError('');
    setResend({ state: 'idle' });
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

  const resendDecision = async () => {
    if (!result || !query.trim() || !email.trim()) return;
    setResend({ state: 'sending' });
    const response = await fetch('/api/admissions/resend-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: query.trim(), email: email.trim() })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setResend({ state: 'error', message: payload.error || 'The decision email could not be resent right now.' });
      return;
    }
    setResend({ state: 'done', message: payload.message || 'A fresh copy of the decision email has been sent.' });
  };

  const isFinalDecision = result?.status === 'approved' || result?.status === 'rejected';

  return (
    <div className="py-12 sm:py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs uppercase tracking-[0.16em] text-mipc-green-700 font-bold block">
            MIPC Admissions
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950">
            Check your application status
          </h1>
          <p className="text-sm text-ink-700">
            Enter your complete private application reference and the email address used when you applied.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 sm:p-8 shadow-academic">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.12em] font-semibold text-ink-800 mb-1.5">
                Application reference
              </label>
              <input
                required
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste the complete private reference"
                className="w-full rounded-xl border border-ink-900/15 p-3.5 text-sm text-ink-950 outline-none focus-visible:border-mipc-green-500 bg-parchment-50/50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.12em] font-semibold text-ink-800 mb-1.5">
                Application email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-ink-900/15 p-3.5 text-sm text-ink-950 outline-none focus-visible:border-mipc-green-500 bg-parchment-50/50"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-mipc-green-700 py-3 text-sm font-semibold text-white hover:bg-mipc-green-800 transition-colors shadow-sm"
            >
              Check application status
            </button>
          </form>

          {error && <p role="alert" className="mt-6 rounded-xl bg-signal-danger-bg p-4 text-sm text-signal-danger">{error}</p>}
          {searched && !error && (
            <div className="mt-8 pt-6 border-t border-parchment-200">
              {result ? (
                <div className="space-y-4 bg-parchment-50 rounded-xl p-5 border border-parchment-300">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-mipc-green-800">
                      Reference ending {result.id.slice(-6).toUpperCase()}
                    </span>
                    {result.status === 'approved' ? (
                      <span className="text-[11px] text-signal-ok bg-signal-ok-bg px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        <span>Application approved</span>
                      </span>
                    ) : result.status === 'rejected' ? (
                      <span className="text-[11px] text-signal-danger bg-signal-danger-bg px-2.5 py-1 rounded-full font-bold uppercase tracking-wide">
                        Application declined
                      </span>
                    ) : (
                      <span className="text-[11px] text-signal-warn bg-signal-warn-bg px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>Under review</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-xl font-bold text-ink-950">
                      {result.full_name}
                    </h3>
                  </div>

                  <div className="text-sm text-ink-700 bg-white p-4 rounded-lg border border-parchment-200 space-y-2.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-ink-500">Submitted</span>
                      <span>{new Date(result.submitted_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-ink-500">Institution</span>
                      <span className="font-medium text-ink-900">MIPC Musanze Campus</span>
                    </div>
                    {result.status === 'approved' && (
                      <div className="pt-3 mt-3 border-t border-parchment-200 text-signal-ok font-semibold leading-6">
                        Your application has been approved. The Registrar will complete your official student registration and academic placement next.
                      </div>
                    )}
                    {result.status === 'rejected' && (
                      <div className="pt-3 mt-3 border-t border-parchment-200 text-signal-danger font-semibold leading-6">
                        Your application was reviewed and was not approved for this intake.
                      </div>
                    )}
                  </div>

                  {isFinalDecision && (
                    <div className="rounded-xl border border-mipc-green-700/15 bg-white p-4">
                      <p className="text-sm font-semibold text-ink-900">Didn&apos;t receive the decision email?</p>
                      <p className="mt-1 text-xs leading-5 text-ink-600">Request another copy to the same email address used for this application.</p>
                      <button
                        type="button"
                        onClick={resendDecision}
                        disabled={resend.state === 'sending'}
                        className="mt-3 inline-flex items-center rounded-lg border border-mipc-green-700/20 px-3.5 py-2 text-xs font-bold text-mipc-green-700 transition hover:bg-mipc-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resend.state === 'sending' ? 'Sending…' : 'Resend decision email'}
                      </button>
                      {resend.message && (
                        <p role="status" className={`mt-3 text-xs leading-5 ${resend.state === 'done' ? 'text-signal-ok' : 'text-signal-danger'}`}>{resend.message}</p>
                      )}
                    </div>
                  )}

                  {result.status === 'approved' && (
                    <div className="pt-2">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-mipc-green-700 hover:text-mipc-green-800"
                      >
                        <span>Go to the campus portal</span>
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-signal-warn-bg text-signal-warn rounded-xl p-5 border border-signal-warn/20 flex items-start gap-3">
                  <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-bold">Application not found</p>
                    <p>We could not find an application matching that reference and email address. Check both values and try again.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
