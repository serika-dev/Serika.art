import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Being logged out is a normal answer here, not an error: every page
    // asks on load, and a 401 shows up as a console error for every visitor.
    if (!user) {
      return NextResponse.json(
        { success: false, user: null, error: 'Not authenticated' },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 401 }
    );
  }
}
