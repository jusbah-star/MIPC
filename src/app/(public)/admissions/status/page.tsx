'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AwardIcon,
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="py-12 sm:py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-mipc-green-700 font-bold block">
            MIPC Admissions Registry Tracker
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950">
            Check Application Status
          </h1>
          <p className="text-sm text-ink-700">
            Enter your candidate dossier reference code or registered email address to view your admissions status.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-ink-900/10 p-6 sm:p-8 shadow-academic">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-ink-800 mb-1.5">
                Complete application reference
              </label>
              <input
                required
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Paste the complete private reference"
                className="w-full rounded-xl border border-ink-900/15 p-3.5 text-sm text-ink-950 font-mono outline-none focus-visible:border-mipc-green-500 bg-parchment-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider font-semibold text-ink-800 mb-1.5">
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
              className="w-full rounded-xl bg-ink-900 py-3 text-sm font-semibold text-white hover:bg-ink-800 transition-colors shadow-sm"
            >
              Verify Dossier in Admissions Ledger
            </button>
          </form>

          {error && <p role="alert" className="mt-6 rounded-xl bg-signal-danger-bg p-4 text-sm text-signal-danger">{error}</p>}
          {searched && !error && (
            <div className="mt-8 pt-6 border-t border-parchment-200">
              {result ? (
                <div className="space-y-4 bg-parchment-50 rounded-xl p-5 border border-parchment-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-mipc-green-800">
                      Dossier #{result.id.slice(-6).toUpperCase()}
                    </span>
                    {result.status === 'approved' ? (
                      <span className="text-[10px] font-mono text-signal-ok bg-signal-ok-bg px-2.5 py-1 rounded font-bold uppercase flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        <span>Admitted & Matriculated</span>
                      </span>
                    ) : result.status === 'rejected' ? (
                      <span className="text-[10px] font-mono text-signal-danger bg-signal-danger-bg px-2.5 py-1 rounded font-bold uppercase">
                        Decision Finalized (Declined)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-signal-warn bg-signal-warn-bg px-2.5 py-1 rounded font-bold uppercase flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>Under Academic Review</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-lg font-bold text-ink-950">
                      {result.full_name}
                    </h3>
                  </div>

                  <div className="text-xs font-mono text-ink-700 bg-white p-3.5 rounded-lg border border-parchment-200 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-ink-500">Submitted:</span>
                      <span>{new Date(result.submitted_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-500">Institution:</span>
                      <span className="font-medium text-ink-900">MIPC Musanze Campus</span>
                    </div>
                    {result.status === 'approved' && (
                      <div className="pt-2 mt-2 border-t border-parchment-200 text-signal-ok font-semibold">
                        Formal acceptance granted. Please report to the MIPC Registrar Office for matriculation credentials.
                      </div>
                    )}
                  </div>

                  {result.status === 'approved' && (
                    <div className="pt-2">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-mipc-green-700 hover:text-mipc-green-800"
                      >
                        <span>Proceed to Student Portal SSO</span>
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-signal-warn-bg text-signal-warn rounded-xl p-5 border border-signal-warn/20 flex items-start gap-3">
                  <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold">No Candidate Record Located</p>
                    <p>
                      We were unable to locate a candidate record matching &ldquo;{query}&rdquo;. Verify your reference number or email, or submit a new application.
                    </p>
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
