import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { createAuthDeliveryClient } from '@/lib/supabase/auth-delivery';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import {
  GENERIC_SIGN_IN_MESSAGE,
  normalizeEmail,
  normalizeRegistrationNumber,
  portalIdentityKey,
  profileCanAccessPortal,
  STAFF_ROLES
} from '@/lib/auth-policy';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

type PortalRole = 'student' | 'staff' | 'admin';
const PRODUCTION_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://mipc-rosy.vercel.app';

function requestedPortal(value: unknown): PortalRole {
  const portal = requiredText(value, 'Portal', 20, 5).trim().toLowerCase();
  if (portal !== 'student' && portal !== 'staff' && portal !== 'admin') {
    throw new ValidationError('Choose a valid MIPC portal.');
  }
  return portal;
}

function genericSuccess() {
  return NextResponse.json({ ok: true, mode: 'link', message: GENERIC_SIGN_IN_MESSAGE }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    jsonBodySize(request, 8_000);
    await enforceRateLimit(`portal-link-ip:${clientAddress(request)}`, 300, 15 * 60 * 1000);

    const body = await request.json();
    const portal = requestedPortal(body.portal);
    const email = normalizeEmail(emailAddress(body.email));
    const registrationNumber = portal === 'student'
      ? normalizeRegistrationNumber(requiredText(body.registrationNumber, 'Registration number', 40, 4))
      : '';

    await enforceRateLimit(`portal-link-account:${portalIdentityKey(portal, email, registrationNumber)}`, 5, 15 * 60 * 1000);

    const admin = createAdminClient() as any;
    let result: any;
    if (portal === 'student') {
      result = await admin.from('profiles').select('id, email, account_status, registration_number, role').eq('registration_number', registrationNumber).eq('role', 'student').maybeSingle();
    } else if (portal === 'staff') {
      result = await admin.from('profiles').select('id, email, account_status, role').ilike('email', email).in('role', STAFF_ROLES).maybeSingle();
    } else {
      result = await admin.from('profiles').select('id, email, account_status, role').ilike('email', email).eq('role', 'admin').maybeSingle();
    }

    if (result.error) {
      console.error('Portal identity lookup failed', { code: result.error.code, portal });
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    const profile = result.data;
    const matches = Boolean(profileCanAccessPortal(profile, portal) && normalizeEmail(profile?.email) === email && (portal !== 'student' || normalizeRegistrationNumber(profile?.registration_number) === registrationNumber));
    if (!matches) return genericSuccess();

    const baseUrl = process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : new URL(request.url).origin;
    const confirmationUrl = new URL('/auth/confirm', baseUrl).toString();
    const supabase = createAuthDeliveryClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: confirmationUrl
      }
    });
    if (error) console.error('Portal sign-in link dispatch failed', { message: error.message, portal });
    return genericSuccess();
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') return NextResponse.json({ error: 'Too many sign-in requests. Please wait a few minutes and try again.' }, { status: 429 });
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
