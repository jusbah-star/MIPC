'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const EMAIL = 'thetesemuragije@gmail.com';

export default function Page() {
  const [fullName, setFullName] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const response = await fetch('/api/auth/register-admin/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, fullName })
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(payload.error || 'Could not send confirmation email.');
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-10">
      <div className="mx-auto mt-16 max-w-md rounded-[1.75rem] bg-white p-8 shadow-academic">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-mipc-green-700">Administrator setup</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-mipc-navy-950">Register administrator</h1>
        <p className="mt-3 text-sm leading-6 text-ink-500">Only the approved MIPC administrator email can register. The role is assigned by the server after the email is verified.</p>

        {!sent ? (
          <form onSubmit={send} className="mt-7 space-y-5">
            <div>
              <label className="mipc-label">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mipc-field !min-h-12" required />
            </div>
            <div>
              <label className="mipc-label">Administrator email</label>
              <input type="email" value={EMAIL} className="mipc-field !min-h-12 bg-ink-50" readOnly />
            </div>
            <button disabled={busy} className="mipc-button-primary w-full !bg-mipc-green-700">
              {busy ? 'Sending…' : 'Send confirmation link'}
            </button>
          </form>
        ) : (
          <div className="mt-7 space-y-5">
            <div className="rounded-xl bg-mipc-green-50 p-4 text-sm leading-6 text-mipc-green-900">
              <strong>Check your email.</strong><br />
              Open the message sent to <strong>{EMAIL}</strong> and tap <strong>Confirm email address</strong>. MIPC will finish the administrator setup automatically and open the Admin portal.
            </div>
            <button type="button" onClick={() => setSent(false)} className="mipc-button-secondary w-full">Send another confirmation link</button>
          </div>
        )}

        {error && <p className="mt-5 rounded-xl bg-signal-danger-bg p-3 text-sm text-signal-danger">{error}</p>}
        <p className="mt-6 text-center text-xs text-ink-500"><Link href="/login" className="font-semibold text-mipc-green-800">Back to sign in</Link></p>
      </div>
    </main>
  );
}
