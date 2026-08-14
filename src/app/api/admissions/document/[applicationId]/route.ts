import { NextResponse } from 'next/server';
import { requireActiveGovernanceRole } from '@/lib/governance-server';
import { uuid, ValidationError } from '@/lib/validation';

const BUCKET = 'admission-diplomas';

export async function GET(_request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const { admin } = await requireActiveGovernanceRole(['registrar', 'admin']);
    const { applicationId: rawApplicationId } = await context.params;
    const applicationId = uuid(rawApplicationId, 'Application');

    const { data: application, error } = await admin
      .from('applications')
      .select('documents_path')
      .eq('id', applicationId)
      .single();

    if (error || !application?.documents_path) {
      return NextResponse.json({ error: 'Secondary diploma not found.' }, { status: 404 });
    }

    const { data, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(application.documents_path, 120, { download: false });

    if (signedError || !data?.signedUrl) {
      console.error('Admission diploma signed URL failed', { applicationId, message: signedError?.message });
      return NextResponse.json({ error: 'Secondary diploma is temporarily unavailable.' }, { status: 503 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
