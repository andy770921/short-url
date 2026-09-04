import { NextResponse, type NextRequest } from 'next/server';
import { isShortCodePath } from '@/utils/short-code/short-code';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Short links live on the frontend origin so they share the app's domain, but the
 * lookup lives in the backend. Hand /:shortCode over to the backend, which answers
 * with the 302 to the original URL (or 404/410 when it is unknown or expired).
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isShortCodePath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(`${pathname}${search}`, API_URL), 307);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
