import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import type { UserRole } from '@/lib/database.types';

const PORTAL_ROLES: Record<string, UserRole> = {
  student: 'student',
  lecturer: 'lecturer',
  admin: 'admin'
};

function redirectWithCookies(url: URL | string, sourceResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie.name, cookie.value));
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const portalSegment = path.split('/')[1];
  if (!(portalSegment in PORTAL_ROLES)) return response;

  const demoRole = request.cookies.get('mipc_demo_role')?.value;
  if (!supabase) {
    if (demoRole && demoRole in PORTAL_ROLES) {
      if (portalSegment !== demoRole) return redirectWithCookies(new URL(`/${demoRole}`, request.url), response);
      return response;
    }
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', path);
    return redirectWithCookies(redirectUrl, response);
  }

  if (!user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('next', path);
    return redirectWithCookies(redirectUrl, response);
  }

  const { data: profile } = await supabase.from('profiles').select('role, account_status').eq('id', user.id).single();
  if ((profile as any)?.account_status === 'suspended') {
    const suspendedUrl = new URL('/login', request.url);
    suspendedUrl.searchParams.set('error', 'account_suspended');
    return redirectWithCookies(suspendedUrl, response);
  }
  const requiredRole = PORTAL_ROLES[portalSegment];
  if (!profile || (profile as any).role !== requiredRole) {
    const fallback = (profile as any)?.role ? `/${(profile as any).role}` : '/login';
    return redirectWithCookies(new URL(fallback, request.url), response);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
