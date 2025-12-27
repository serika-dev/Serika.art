import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Redirect /user/Anonymous (or any case variation) to /user/anonymous
  if (pathname.toLowerCase() === '/user/anonymous' && pathname !== '/user/anonymous') {
    return NextResponse.redirect(new URL('/user/anonymous', request.url));
  }
  
  // Allow anonymous uploads - no authentication required
  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*', '/user/:path*'],
};
