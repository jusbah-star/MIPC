import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { dataStore } from '@/lib/data-store';
import { emailAddress, jsonBodySize, requiredText, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

const REQUEST_TYPES = new Set(['access', 'rectification', 'restriction', 'erasure', 'portability', 'objection']);

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 24_000);
    enforceRateLimit(`privacy:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const requestType = requiredText(body.requestType, 'Request type', 32);
    if (!REQUEST_TYPES.has(requestType)) throw new ValidationError('Choose a valid data-rights request.');
    const payload = {
      request_type: requestType,
      full_name: requiredText(body.fullName, 'Full name', 160, 2),
      email: emailAddress(body.email),
      details: requiredText(body.details, 'Request details', 5000, 10)
    };

    if (!isSupabaseConfigured()) {
      const reference = `privacy-${Date.now()}`;
      (dataStore as any).data_subject_requests ??= [];
      (dataStore as any).data_subject_requests.push({ id: reference, ...payload, status: 'received' });
      return NextResponse.json({ ok: true, reference, mode: 'demo' }, { status: 201 });
    }

    const admin = createAdminClient();
    const { data, error } = await (admin.from('data_subject_requests') as any)
      .insert(payload)
      .select('id')
      .single();
    if (error || !data) {
      console.error('Privacy request insert failed', { code: error?.code });
      return NextResponse.json({ error: 'Your request could not be recorded. Please try again.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, reference: data.id, mode: 'live' }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Your request could not be recorded. Please try again.' }, { status: 500 });
  }
}
