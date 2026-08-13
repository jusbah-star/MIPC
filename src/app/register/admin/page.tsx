'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const EMAIL = 'thetesemuragije@gmail.com';

export default function Page() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(EMAIL);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const r = await fetch('/api/auth/register-admin/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const p = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(p.error || 'Could not send code.');
    setSent(true);
  }

  async function finish(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const supabase = createClient();
    const verified = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (verified.error) { setBusy(false); return setError('Invalid or expired code.'); }
    const r = await fetch('/api/auth/register-admin/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName }) });
    const p = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(p.error || 'Could not complete registration.');
    router.replace('/admin'); router.refresh();
  }

  return <main className="min-h-screen bg-[#f4f7f5] px-5 py-10"><div className="mx-auto mt-16 max-w-md rounded-[1.75rem] bg-white p-8 shadow-academic">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-mipc-green-700">Administrator setup</p>
    <h1 className="mt-2 font-display text-3xl font-bold text-mipc-navy-950">Register administrator</h1>
    <p className="mt-3 text-sm leading-6 text-ink-500">Only the MIPC-approved administrator email can register. Verification and role assignment are enforced by the server.</p>
    {!sent ? <form onSubmit={send} className="mt-7 space-y-5">
      <div><label className="mipc-label">Full name</label><input value={fullName} onChange={e=>setFullName(e.target.value)} className="mipc-field !min-h-12" required /></div>
      <div><label className="mipc-label">Administrator email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mipc-field !min-h-12" required /><p className="mt-1 text-xs text-ink-500">Approved: {EMAIL}</p></div>
      <button disabled={busy} className="mipc-button-primary w-full !bg-mipc-green-700">{busy?'Sending…':'Send registration code'}</button>
    </form> : <form onSubmit={finish} className="mt-7 space-y-5">
      <p className="rounded-xl bg-mipc-green-50 p-4 text-sm text-mipc-green-900">Enter the code sent to <strong>{email}</strong>.</p>
      <div><label className="mipc-label">6-digit code</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} className="mipc-field !min-h-14 text-center font-mono text-2xl font-bold tracking-[.35em]" inputMode="numeric" required /></div>
      <button disabled={busy || code.length!==6} className="mipc-button-primary w-full !bg-mipc-green-700">{busy?'Registering…':'Verify and register'}</button>
    </form>}
    {error && <p className="mt-5 rounded-xl bg-signal-danger-bg p-3 text-sm text-signal-danger">{error}</p>}
  </div></main>;
}
