import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createAuthDeliveryClient } from '@/lib/supabase/auth-delivery';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

type PortalRole = 'student' | 'lecturer' | 'admin';

function requestedPortal(value: unknown): PortalRole {
  const portal = requiredText(value, 'Portal', 20, 5).trim().toLowerCase();
  if (portal !== 'student' && portal !== 'lecturer' && portal !== 'admin') {
    throw new ValidationError('Choose a valid MIPC portal.');
  }
  return portal;
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 8_000);
    await enforceRateLimit(`portal-link:${clientAddress(request)}`, 5, 15 * 60 * 1000);

    const body = await request.json();
    const portal = requestedPortal(body.portal);
    const email = emailAddress(body.email).trim().toLowerCase();
    const admin = createAdminClient() as any;

    let profile: any = null;
    let lookupError: any = null;

    if (portal === 'student') {
      const registrationNumber = requiredText(body.registrationNumber, 'Registration number', 40, 4).trim().toUpperCase();
      const result = await admin
        .from('profiles')
        .select('id, email, account_status, registration_number, role')
        .eq('registration_number', registrationNumber)
        .eq('role', 'student')
        .maybeSingle();
      profile = result.data;
      lookupError = result.error;

      const matchesStudent = profile &&
        String(profile.email || '').trim().toLowerCase() === email &&
        profile.account_status === 'active' &&
        profile.role === 'student';

      if (!lookupError && !matchesStudent) {
        return NextResponse.json({ error: 'Those details do not match an active MIPC student account.' }, { status: 400 });
      }
    } else {
      const result = await admin
        .from('profiles')
        .select('id, email, account_status, role')
        .eq('email', email)
        .eq('role', portal)
        .maybeSingle();
      profile = result.data;
      lookupError = result.error;

      const matchesStaff = profile &&
        String(profile.email || '').trim().toLowerCase() === email &&
        profile.account_status === 'active' &&
        profile.role === portal;

      if (!lookupError && !matchesStaff) {
        return NextResponse.json({ error: 'That email does not match an active account for the selected MIPC portal.' }, { status: 400 });
      }
    }

    if (lookupError) {
      console.error('Portal identity lookup failed', { code: lookupError.code, portal });
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    const origin = new URL(request.url).origin;
    const supabase = createAuthDeliveryClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: origin
      }
    });

    if (error) {
      console.error('Portal sign-in link dispatch failed', { message: error.message, portal });
      return NextResponse.json({ error: 'We could not send the sign-in link. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, mode: 'link' }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many sign-in requests. Please wait a few minutes and try again.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
