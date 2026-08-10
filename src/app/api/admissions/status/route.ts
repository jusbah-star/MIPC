import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 8_000);
    enforceRateLimit(`admission-status:${clientAddress(request)}`, 10, 60 * 60 * 1000);
    const body = await request.json();
    const reference = requiredText(body.reference, 'Application reference', 64, 5);
    const email = emailAddress(body.email);

    if (!isSupabaseConfigured()) {
      const record = dataStore.applications.find(
        (item) => item.id.toLowerCase() === reference.toLowerCase() && item.email.toLowerCase() === email
      );
      return NextResponse.json({ application: record ? publicApplication(record) : null, mode: 'demo' });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('applications')
      .select('id, full_name, status, submitted_at, reviewed_at')
      .eq('id', reference)
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Admission status lookup failed', { code: error.code });
      return NextResponse.json({ error: 'Status is temporarily unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ application: data, mode: 'live' });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many status checks. Please wait before trying again.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Status is temporarily unavailable.' }, { status: 500 });
  }
}

function publicApplication(record: any) {
  return {
    id: record.id,
    full_name: record.full_name,
    status: record.status,
    submitted_at: record.submitted_at,
    reviewed_at: record.reviewed_at
  };
}
