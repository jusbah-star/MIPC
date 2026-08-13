import { NextResponse } from 'next/server';
import { createAdminClient, createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { jsonBodySize, requiredText, ValidationError } from '@/lib/validation';

const DESIGNATED_ADMIN_EMAIL = 'thetesemuragije@gmail.com';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Administrator registration is temporarily unavailable.' }, { status: 503 });
    }

    jsonBodySize(request, 4_000);
    const body = await request.json();
    const fullName = requiredText(body.fullName, 'Full name', 120, 2);

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const email = user?.email?.trim().toLowerCase();

    if (userError || !user || email !== DESIGNATED_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'A verified approved administrator session is required.' }, { status: 403 });
    }

    const admin = createAdminClient() as any;
    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      role: 'admin',
      full_name: fullName,
      email: DESIGNATED_ADMIN_EMAIL,
      account_status: 'active',
      registration_number: null,
      department_id: null,
      cohort_id: null,
      year_of_study: null
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Administrator profile finalization failed', { code: profileError.code });
      return NextResponse.json({ error: 'We could not complete administrator registration.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, redirectTo: '/admin' });
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Administrator registration is temporarily unavailable.' }, { status: 500 });
  }
}
