import { mobileConfig } from './supabase';
import type { LoginPortal } from '../types';

export async function requestMobileOtp(input: {
  portal: LoginPortal;
  email: string;
  registrationNumber?: string;
}) {
  const response = await fetch(`${mobileConfig.apiUrl}/api/auth/mobile-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'We could not process this sign-in request.');
  }

  return payload as { ok: true; mode: 'otp'; message: string };
}
