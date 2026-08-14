import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import type { AccountRole } from '@/lib/roles';
import { isAccountRole, roleCanOpenSegment } from '@/lib/roles';

const PORTAL_ROLES: Record<string, AccountRole> = {
  student: 'student',
  lecturer: 'lecturer',
  hod: 'hod',
  registrar: 'registrar',
  finance: 'finance',
  admin: 'admin'
};
function redirectWithCookies(url: URL | string, sourceResponse: NextResponse) { const redirectResponse = NextResponse.redirect(url); sourceResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie.name, cookie.value)); return redirectResponse; }
function backendUnavailable() { return new NextResponse('MIPC portal is temporarily unavailable because its authentication backend is not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }

export async function proxy(request: NextRequest) {
  const { response, supabase, user, demoEnabled } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (path === '/login' && !supabase && !demoEnabled) return backendUnavailable();
  const portalSegment = path.split('/')[1];
  if (!(portalSegment in PORTAL_ROLES)) return response;
  if (!supabase) {
    if (!demoEnabled) return backendUnavailable();
    const demoRole = request.cookies.get('mipc_demo_role')?.value;
    if (demoRole && demoRole in PORTAL_ROLES) { if (portalSegment !== demoRole) return redirectWithCookies(new URL(`/${demoRole}`, request.url), response); return response; }
    const redirectUrl = new URL('/login', request.url); redirectUrl.searchParams.set('next', path); return redirectWithCookies(redirectUrl, response);
  }
  if (!user) { const redirectUrl = new URL('/login', request.url); redirectUrl.searchParams.set('next', path); return redirectWithCookies(redirectUrl, response); }
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).single();
  if (profileError) return backendUnavailable();
  const storedRole = (profile as any)?.role;
  if (!profile || (profile as any).account_status !== 'active' || !isAccountRole(storedRole)) {
    const unavailableUrl = new URL('/login', request.url);
    unavailableUrl.searchParams.set('error', (profile as any)?.account_status === 'suspended' ? 'account_suspended' : 'account_unavailable');
    return redirectWithCookies(unavailableUrl, response);
  }
  if (!roleCanOpenSegment(storedRole, portalSegment)) {
    return redirectWithCookies(new URL(`/${storedRole}`, request.url), response);
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
