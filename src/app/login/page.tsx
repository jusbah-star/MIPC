import { Suspense } from 'react';
import { PortalLogin } from './portal-login';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f4f7f5] text-sm text-ink-500">Loading campus portal…</div>}>
      <PortalLogin />
    </Suspense>
  );
}
