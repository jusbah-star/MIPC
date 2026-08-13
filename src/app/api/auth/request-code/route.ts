import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createAuthDeliveryClient } from '@/lib/supabase/auth-delivery';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { GENERIC_SIGN_IN_MESSAGE, normalizeEmail, normalizeRegistrationNumber, portalIdentityKey } from '@/lib/auth-policy';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

type PortalRole = 'student' | 'lecturer' | 'admin';
const PRODUCTION_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://mipc-rosy.vercel.app';
function requestedPortal(value: unknown): PortalRole {
  const portal = requiredText(value, 'Portal', 20, 5).trim().toLowerCase();
  if (portal !== 'student' && portal !== 'lecturer' && portal !== 'admin') throw new ValidationError('Choose a valid MIPC portal.');
  return portal;
}
function genericSuccess() { return NextResponse.json({ ok: true, mode: 'link', message: GENERIC_SIGN_IN_MESSAGE }, { status: 200 }); }

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    jsonBodySize(request, 8_000);
    await enforceRateLimit(`portal-link-ip:${clientAddress(request)}`, 300, 15 * 60 * 1000);
    const body = await request.json();
    const portal = requestedPortal(body.portal);
    const email = normalizeEmail(emailAddress(body.email));
    let profile: any = null;
    let lookupError: any = null;
    let registrationNumber = '';
    const admin = createAdminClient() as any;

    if (portal === 'student') {
      registrationNumber = normalizeRegistrationNumber(requiredText(body.registrationNumber, 'Registration number', 40, 4));
      const result = await admin.from('profiles').select('id, email, account_status, registration_number, role').eq('registration_number', registrationNumber).eq('role', 'student').maybeSingle();
      profile = result.data; lookupError = result.error;
      const matchesStudent = profile && normalizeEmail(profile.email) === email && profile.account_status === 'active' && profile.role === 'student';
      if (!lookupError && !matchesStudent) return genericSuccess();
    } else {
      const result = await admin.from('profiles').select('id, email, account_status, role').eq('email', email).eq('role', portal).maybeSingle();
      profile = result.data; lookupError = result.error;
      const matchesStaff = profile && normalizeEmail(profile.email) === email && profile.account_status === 'active' && profile.role === portal;
      if (!lookupError && !matchesStaff) return genericSuccess();
    }

    await enforceRateLimit(`portal-link-account:${portalIdentityKey(portal, email, registrationNumber)}`, 5, 15 * 60 * 1000);
    if (lookupError) return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    const baseUrl = process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : new URL(request.url).origin;
    const supabase = createAuthDeliveryClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: new URL('/login', baseUrl).toString() } });
    if (error) console.error('Portal sign-in link dispatch failed', { message: error.message, portal });
    return genericSuccess();
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') return NextResponse.json({ error: 'Too many sign-in requests. Please wait a few minutes and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
