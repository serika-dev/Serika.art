import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  const { pathname } = request.nextUrl;

  // Protect upload route
  if (pathname.startsWith('/upload') && !sessionToken) {
    const loginUrl = new URL(
      `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/login`,
    );
    loginUrl.searchParams.set('redirect', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*'],
};
