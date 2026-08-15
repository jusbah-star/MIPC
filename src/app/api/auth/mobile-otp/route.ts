import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { sendPortalOtpEmail } from '@/lib/portal-auth-mail';
import {
  normalizeEmail,
  normalizeRegistrationNumber,
  portalIdentityKey,
  profileCanAccessPortal,
  STAFF_ROLES
} from '@/lib/auth-policy';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

type PortalRole = 'student' | 'staff' | 'admin';

const GENERIC_MOBILE_OTP_MESSAGE =
  'If those details match an active MIPC account, a one-time sign-in code has been sent.';

function requestedPortal(value: unknown): PortalRole {
  const portal = requiredText(value, 'Portal', 20, 5).trim().toLowerCase();
  if (portal !== 'student' && portal !== 'staff' && portal !== 'admin') {
    throw new ValidationError('Choose a valid MIPC portal.');
  }
  return portal;
}

function genericSuccess() {
  return NextResponse.json({ ok: true, mode: 'otp', message: GENERIC_MOBILE_OTP_MESSAGE }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 8_000);
    await enforceRateLimit(`mobile-otp-ip:${clientAddress(request)}`, 300, 15 * 60 * 1000);

    const body = await request.json();
    const portal = requestedPortal(body.portal);
    const email = normalizeEmail(emailAddress(body.email));
    const registrationNumber = portal === 'student'
      ? normalizeRegistrationNumber(requiredText(body.registrationNumber, 'Registration number', 40, 4))
      : '';

    await enforceRateLimit(
      `mobile-otp-account:${portalIdentityKey(portal, email, registrationNumber)}`,
      5,
      15 * 60 * 1000
    );

    const admin = createAdminClient() as any;
    let result: any;

    if (portal === 'student') {
      result = await admin
        .from('profiles')
        .select('id, email, account_status, registration_number, role')
        .eq('registration_number', registrationNumber)
        .eq('role', 'student')
        .maybeSingle();
    } else if (portal === 'staff') {
      result = await admin
        .from('profiles')
        .select('id, email, account_status, role')
        .ilike('email', email)
        .in('role', STAFF_ROLES)
        .maybeSingle();
    } else {
      result = await admin
        .from('profiles')
        .select('id, email, account_status, role')
        .ilike('email', email)
        .eq('role', 'admin')
        .maybeSingle();
    }

    if (result.error) {
      console.error('Mobile portal identity lookup failed', { code: result.error.code, portal });
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    const profile = result.data;
    const matches = Boolean(
      profileCanAccessPortal(profile, portal)
      && normalizeEmail(profile?.email) === email
      && (portal !== 'student' || normalizeRegistrationNumber(profile?.registration_number) === registrationNumber)
    );
    if (!matches) return genericSuccess();

    const identity = await admin.auth.admin.getUserById(profile.id);
    if (identity.error || !identity.data?.user || normalizeEmail(identity.data.user.email) !== email) {
      console.error('Mobile portal Auth identity is unavailable', {
        portal,
        profileId: profile.id,
        code: identity.error?.status || null
      });
      return genericSuccess();
    }

    const { data: otpData, error: otpError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email
    });
    const otp = otpData?.properties?.email_otp;

    if (otpError || !otp) {
      console.error('Mobile portal OTP generation failed', {
        portal,
        message: otpError?.message || 'Missing email OTP'
      });
      return genericSuccess();
    }

    try {
      const handoff = await sendPortalOtpEmail({ to: email, otp });
      console.info('Mobile portal OTP accepted by MIPC SMTP', {
        portal,
        messageId: handoff.messageId,
        providerResponse: handoff.providerResponse
      });
    } catch (error) {
      console.error('Mobile portal OTP delivery failed', {
        portal,
        message: error instanceof Error ? error.message : 'Unknown SMTP delivery error'
      });
    }

    return genericSuccess();
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'Too many sign-in requests. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
