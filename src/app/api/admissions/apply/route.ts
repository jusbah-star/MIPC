import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, isDemoModeEnabled, isSupabaseConfigured } from '@/lib/supabase/server';
import { submitApplication } from '@/lib/data-store';
import { booleanTrue, emailAddress, jsonBodySize, optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 32_000);
    await enforceRateLimit(`admission:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const application = {
      full_name: requiredText(body.fullName, 'Full legal name', 160, 2),
      email: emailAddress(body.email),
      phone: optionalText(body.phone, 'Phone number', 32),
      department_id: uuid(body.departmentId, 'Programme'),
      statement: optionalText(body.statement, 'Statement of purpose', 5000)
    };
    booleanTrue(body.privacyConsent, 'Privacy acknowledgement');

    if (!isSupabaseConfigured()) {
      if (!isDemoModeEnabled()) {
        return NextResponse.json({ error: 'Admissions are temporarily unavailable.' }, { status: 503 });
      }
      const saved = await submitApplication(application);
      return NextResponse.json({ ok: true, reference: saved.id, mode: 'demo' }, { status: 201 });
    }

    const id = randomUUID();
    const supabase = await createClient();
    const { error } = await supabase.from('applications').insert({
      id,
      ...application,
      status: 'pending',
      privacy_consent_at: new Date().toISOString()
    } as any);

    if (error) {
      console.error('Admission insert failed', { code: error.code });
      return NextResponse.json({ error: 'Your application could not be recorded. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, reference: id, mode: 'live' }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many applications were sent from this connection. Please try again later.' }, { status: 429 });
    }
    if (error instanceof Error && (error.message === 'RATE_LIMIT_UNAVAILABLE' || error.message === 'BACKEND_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'Admissions are temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Your application could not be recorded. Please try again.' }, { status: 500 });
  }
}
