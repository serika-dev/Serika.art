import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow anonymous uploads - no authentication required
  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*'],
};
