import { NextResponse } from 'next/server';
import { createAdminClient, isDemoModeEnabled, isSupabaseConfigured } from '@/lib/supabase/server';
import { submitApplication } from '@/lib/data-store';
import { deliverApplicationNotifications } from '@/lib/application-mail';
import { booleanTrue, emailAddress, jsonBodySize, optionalText, requiredText, uuid, ValidationError } from '@/lib/validation';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

const DIPLOMA_BUCKET = 'admission-diplomas';
const DIPLOMA_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/secondary-diploma\.(pdf|jpg|png)$/i;

export async function POST(request: Request) {
  try {
    jsonBodySize(request, 32_000);
    await enforceRateLimit(`admission:${clientAddress(request)}`, 5, 60 * 60 * 1000);
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const applicationId = uuid(body.applicationId, 'Application reference');
    const diplomaPath = requiredText(body.diplomaPath, 'Secondary diploma', 260, 20);
    const match = DIPLOMA_PATH.exec(diplomaPath);
    if (!match || match[1].toLowerCase() !== applicationId.toLowerCase()) {
      return NextResponse.json({ error: 'The uploaded secondary diploma could not be verified.' }, { status: 400 });
    }

    const application = {
      full_name: requiredText(body.fullName, 'Full legal name', 160, 2),
      email: emailAddress(body.email),
      phone: optionalText(body.phone, 'Phone number', 32),
      department_id: uuid(body.departmentId, 'Programme'),
      secondary_field_of_study: requiredText(body.secondaryFieldOfStudy, 'Secondary-school field of study', 180, 2),
      national_exam_result: requiredText(body.nationalExamResult, 'National exam result', 120, 1),
      statement: optionalText(body.statement, 'Statement of purpose', 5000),
      documents_path: diplomaPath
    };
    booleanTrue(body.privacyConsent, 'Privacy acknowledgement');

    if (!isSupabaseConfigured()) {
      if (!isDemoModeEnabled()) {
        return NextResponse.json({ error: 'Admissions are temporarily unavailable.' }, { status: 503 });
      }
      const saved = await submitApplication(application as any);
      return NextResponse.json({ ok: true, reference: saved.id, mode: 'demo' }, { status: 201 });
    }

    const admin = createAdminClient();
    const fileName = diplomaPath.split('/').pop()!;
    const { data: files, error: storageError } = await admin.storage.from(DIPLOMA_BUCKET).list(applicationId, {
      limit: 10,
      search: fileName
    });
    if (storageError || !files?.some((file) => file.name === fileName)) {
      console.error('Admission diploma verification failed', { applicationId, message: storageError?.message });
      return NextResponse.json({ error: 'Upload your secondary diploma before submitting the application.' }, { status: 400 });
    }

    const { error } = await (admin as any).from('applications').insert({
      id: applicationId,
      ...application,
      status: 'pending',
      privacy_consent_at: new Date().toISOString()
    });

    if (error) {
      console.error('Admission insert failed', { code: error.code });
      return NextResponse.json({ error: 'Your application could not be recorded. Please try again.' }, { status: 503 });
    }

    await deliverApplicationNotifications(admin as any, applicationId);
    return NextResponse.json({ ok: true, reference: applicationId, mode: 'live' }, { status: 201 });
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
