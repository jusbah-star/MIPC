import { Suspense } from 'react';
import Link from 'next/link';
import { PortalLogin } from './portal-login';

export default function LoginPage() {
  return (
    <div className="relative">
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f4f7f5] text-sm text-ink-500">Loading campus portal…</div>}>
        <PortalLogin />
      </Suspense>
      <Link
        href="/register/admin"
        className="fixed bottom-5 right-5 z-50 rounded-full border border-mipc-green-700/20 bg-white px-4 py-2.5 text-xs font-bold text-mipc-green-800 shadow-academic transition hover:bg-mipc-green-50 sm:text-sm"
      >
        Register administrator account
      </Link>
    </div>
  );
}
