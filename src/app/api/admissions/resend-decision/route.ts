import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { deliverApplicationNotifications } from '@/lib/application-mail';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { emailAddress, jsonBodySize, uuid, ValidationError } from '@/lib/validation';

const GENERIC_MESSAGE = 'If this application has a final decision, a fresh copy has been requested for the application email address.';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Decision email resend is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 4_000);
    const body = await request.json();
    const reference = uuid(body.reference, 'Application reference');
    const email = emailAddress(body.email);
    const address = clientAddress(request);

    await enforceRateLimit(`admission-decision-resend-ip:${address}`, 12, 60 * 60 * 1000);
    await enforceRateLimit(`admission-decision-resend:${reference}:${email}`, 3, 60 * 60 * 1000);

    const admin = createAdminClient();
    const db = admin as any;
    const { data: application, error: applicationError } = await db
      .from('applications')
      .select('id,email,status')
      .eq('id', reference)
      .eq('email', email)
      .maybeSingle();

    if (applicationError) {
      console.error('Decision resend application lookup failed', { code: applicationError.code });
      return NextResponse.json({ error: 'Decision email resend is temporarily unavailable.' }, { status: 503 });
    }

    if (!application || (application.status !== 'approved' && application.status !== 'rejected')) {
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 202 });
    }

    const event = application.status === 'approved' ? 'approved' : 'rejected';
    const { data: existing, error: lookupError } = await db
      .from('application_email_notifications')
      .select('id')
      .eq('application_id', application.id)
      .eq('event', event)
      .maybeSingle();

    if (lookupError) {
      console.error('Decision resend notification lookup failed', { code: lookupError.code });
      return NextResponse.json({ error: 'Decision email resend is temporarily unavailable.' }, { status: 503 });
    }

    if (existing?.id) {
      const { error } = await db
        .from('application_email_notifications')
        .update({
          recipient_email: application.email,
          status: 'pending',
          last_error: null,
          sent_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from('application_email_notifications').insert({
        application_id: application.id,
        event,
        recipient_email: application.email,
        status: 'pending'
      });
      if (error) throw error;
    }

    await deliverApplicationNotifications(admin, application.id);

    const { data: result } = await db
      .from('application_email_notifications')
      .select('status,last_error')
      .eq('application_id', application.id)
      .eq('event', event)
      .maybeSingle();

    if (result?.status === 'failed') {
      console.error('Decision resend SMTP handoff failed', { applicationId: application.id });
      return NextResponse.json({ error: 'The email provider did not accept the resend. Please try again later.' }, { status: 503 });
    }

    return NextResponse.json({ message: 'A fresh copy of the decision email has been sent to your application email address.' });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'You have requested too many decision emails. Please wait before trying again.' }, { status: 429 });
    }
    if (error instanceof Error && (error.message === 'RATE_LIMIT_UNAVAILABLE' || error.message === 'BACKEND_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'Decision email resend is temporarily unavailable.' }, { status: 503 });
    }
    console.error('Decision email resend failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Decision email resend is temporarily unavailable.' }, { status: 500 });
  }
}
