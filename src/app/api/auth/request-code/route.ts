import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { sendPortalSignInEmail } from '@/lib/portal-auth-mail';
import { GENERIC_SIGN_IN_MESSAGE, normalizeEmail, normalizeRegistrationNumber, portalIdentityKey, profileCanAccessPortal, STAFF_ROLES } from '@/lib/auth-policy';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

type PortalRole = 'student' | 'staff' | 'admin';
const PRODUCTION_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://mipc-rosy.vercel.app';
function requestedPortal(value: unknown): PortalRole {
  const portal = requiredText(value, 'Portal', 20, 5).trim().toLowerCase();
  if (portal !== 'student' && portal !== 'staff' && portal !== 'admin') throw new ValidationError('Choose a valid MIPC portal.');
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
    } else if (portal === 'staff') {
      const result = await admin.from('profiles').select('id, email, account_status, role').ilike('email', email).in('role', STAFF_ROLES).maybeSingle();
      profile = result.data; lookupError = result.error;
    } else {
      const result = await admin.from('profiles').select('id, email, account_status, role').ilike('email', email).eq('role', 'admin').maybeSingle();
      profile = result.data; lookupError = result.error;
    }

    await enforceRateLimit(`portal-link-account:${portalIdentityKey(portal, email, registrationNumber)}`, 5, 15 * 60 * 1000);
    if (lookupError) return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    const matches = Boolean(profileCanAccessPortal(profile, portal) && normalizeEmail(profile?.email) === email && (portal !== 'student' || normalizeRegistrationNumber(profile?.registration_number) === registrationNumber));
    if (!matches) return genericSuccess();

    const baseUrl = process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : new URL(request.url).origin;
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('Portal sign-in token generation failed', { message: linkError?.message || 'Missing token hash', portal });
      return genericSuccess();
    }

    const confirmationUrl = new URL('/auth/confirm', baseUrl);
    confirmationUrl.searchParams.set('token_hash', tokenHash);
    confirmationUrl.searchParams.set('type', 'email');
    try {
      const handoff = await sendPortalSignInEmail({ to: email, signInUrl: confirmationUrl.toString() });
      console.info('Portal sign-in email accepted by MIPC SMTP', { portal, messageId: handoff.messageId, providerResponse: handoff.providerResponse });
    } catch (error) {
      console.error('Portal sign-in email delivery failed', { portal, message: error instanceof Error ? error.message : 'Unknown SMTP delivery error' });
    }
    return genericSuccess();
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') return NextResponse.json({ error: 'Too many sign-in requests. Please wait a few minutes and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
