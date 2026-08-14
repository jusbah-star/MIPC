import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';
import { jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

const BUCKET = 'admission-diplomas';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Diploma upload is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 4_000);
    await enforceRateLimit(`admission-diploma:${clientAddress(request)}`, 10, 60 * 60 * 1000);
    const body = await request.json();
    requiredText(body.fileName, 'Diploma file name', 255, 1);
    const fileType = requiredText(body.fileType, 'Diploma file type', 80, 3).toLowerCase();
    const fileSize = Number(body.fileSize);

    if (!MIME_TO_EXTENSION[fileType]) {
      return NextResponse.json({ error: 'Upload the secondary diploma as PDF, JPG, or PNG.' }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'The secondary diploma must be 8 MB or smaller.' }, { status: 400 });
    }

    const applicationId = randomUUID();
    const path = `${applicationId}/secondary-diploma.${MIME_TO_EXTENSION[fileType]}`;
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) {
      console.error('Admission diploma upload token failed', { message: error?.message });
      return NextResponse.json({ error: 'We could not prepare the diploma upload. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ applicationId, path, token: data.token, bucket: BUCKET }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json({ error: 'Too many diploma upload attempts. Please wait and try again.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Diploma upload is temporarily unavailable.' }, { status: 500 });
  }
}
