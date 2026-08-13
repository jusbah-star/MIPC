import { NextResponse } from 'next/server';
import { createAuthDeliveryClient } from '@/lib/supabase/auth-delivery';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

const DESIGNATED_ADMIN_EMAIL = 'thetesemuragije@gmail.com';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Administrator registration is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 4_000);
    await enforceRateLimit(`admin-register-link:${clientAddress(request)}`, 4, 15 * 60 * 1000);

    const body = await request.json();
    const email = emailAddress(body.email).trim().toLowerCase();
    const fullName = requiredText(body.fullName, 'Full name', 120, 2);

    if (email !== DESIGNATED_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'This email is not approved for MIPC administrator registration.' }, { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const supabase = createAuthDeliveryClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: origin,
        data: { full_name: fullName, mipc_admin_registration: true }
      }
    });

    if (error) {
      console.error('Administrator registration link failed', { message: error.message });
      return NextResponse.json({ error: 'We could not send the confirmation link. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, mode: 'link' });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many registration attempts. Please wait and try again.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Administrator registration is temporarily unavailable.' }, { status: 500 });
  }
}
