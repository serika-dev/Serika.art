import { NextResponse } from 'next/server';

// Liveness for Coolify's health check: the new container only gets traffic
// once Next.js answers here, so deploys don't serve 502s while it boots.
// Deliberately no database call: a slow DB shouldn't fail a deploy.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
