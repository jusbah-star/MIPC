import { NextResponse } from 'next/server';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 8_000);
    await enforceRateLimit(`portal-code:${clientAddress(request)}`, 5, 15 * 60 * 1000);

    const body = await request.json();
    const registrationNumber = requiredText(body.registrationNumber, 'Registration number', 40, 4).trim().toUpperCase();
    const email = emailAddress(body.email).trim().toLowerCase();

    const admin = createAdminClient() as any;
    const { data: profile, error: lookupError } = await admin
      .from('profiles')
      .select('id, email, account_status, registration_number')
      .eq('registration_number', registrationNumber)
      .maybeSingle();

    if (lookupError) {
      console.error('Portal identity lookup failed', { code: lookupError.code });
      return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 503 });
    }

    const matches = profile &&
      String(profile.email || '').trim().toLowerCase() === email &&
      profile.account_status === 'active';

    if (!matches) {
      return NextResponse.json({ error: 'Registration number and email do not match an active MIPC account.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }
    });

    if (error) {
      console.error('Portal OTP dispatch failed', { message: error.message });
      return NextResponse.json({ error: 'We could not send the login code. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many code requests. Please wait a few minutes and try again.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Campus sign-in is temporarily unavailable.' }, { status: 500 });
  }
}
