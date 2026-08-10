import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startOrResumeAttempt } from '@/lib/test-attempts';
import { clientAddress, enforceRateLimit } from '@/lib/rate-limit';

// Starts a new attempt or resumes an in-progress one. expires_at is
// computed server-side inside startOrResumeAttempt — never accepted from
// the client. Used by the test-taking page for client-side resume (e.g.
// after a refresh); the initial page load calls the same helper directly.
export async function POST(request: Request, { params }: { params: Promise<{ testId: string }> }) {
  try {
    enforceRateLimit(`exam-start:${clientAddress(request)}`, 30, 60_000);
  } catch {
    return NextResponse.json({ error: 'Too many attempt requests. Try again shortly.' }, { status: 429 });
  }
  const { testId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const result = await startOrResumeAttempt(supabase as any, testId, user.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json(result);
}
