import { NextResponse } from 'next/server';
import { COURSE_MATERIAL_BUCKET } from '@/lib/course-materials-server';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { uuid, ValidationError } from '@/lib/validation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Academic downloads are unavailable.' }, { status: 503 });
    }

    const { materialId: rawMaterialId } = await params;
    const materialId = uuid(rawMaterialId, 'Material');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to download academic materials.' }, { status: 401 });

    const { data: material, error } = await (supabase as any)
      .from('course_materials')
      .select('id,storage_path,file_name')
      .eq('id', materialId)
      .single();

    if (error || !material?.storage_path || !material?.file_name) {
      return NextResponse.json({ error: 'Material not found or you do not have access.' }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data, error: signedError } = await admin.storage
      .from(COURSE_MATERIAL_BUCKET)
      .createSignedUrl(material.storage_path, 90, { download: material.file_name });

    if (signedError || !data?.signedUrl) {
      console.error('Course material signed download failed', { materialId, message: signedError?.message });
      return NextResponse.json({ error: 'The file could not be opened.' }, { status: 503 });
    }

    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'The file could not be opened.' }, { status: 500 });
  }
}
