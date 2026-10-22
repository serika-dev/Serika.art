import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getArtistProfile } from '@/lib/artistProfile';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const { tagName } = await params;
    const profile = await getArtistProfile(tagName);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching artist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artist' },
      { status: 500 }
    );
  }
}

// Update artist profile (verified artist only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));
    const body = await request.json();
    const { bio, socials, avatarUrl, bannerUrl } = body;

    const tagResult = await query(
      `SELECT id FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const artistResult = await query(
      `SELECT * FROM artists WHERE tag_id = $1 AND claimed_by_user_id = $2 AND verified = TRUE`,
      [tagResult.rows[0].id, user.id]
    );

    if (artistResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not verified as this artist' },
        { status: 403 }
      );
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const updateParams: any[] = [];
    let pIdx = 1;

    if (bio !== undefined) {
      setClauses.push(`bio = $${pIdx}`);
      updateParams.push(bio);
      pIdx++;
    }
    if (socials !== undefined) {
      setClauses.push(`socials = $${pIdx}`);
      updateParams.push(JSON.stringify(socials));
      pIdx++;
    }
    if (avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${pIdx}`);
      updateParams.push(avatarUrl);
      pIdx++;
    }
    if (bannerUrl !== undefined) {
      setClauses.push(`banner_url = $${pIdx}`);
      updateParams.push(bannerUrl);
      pIdx++;
    }

    await query(
      `UPDATE artists SET ${setClauses.join(', ')} WHERE id = $${pIdx}`,
      [...updateParams, artistResult.rows[0].id]
    );

    return NextResponse.json({
      success: true,
      message: 'Artist profile updated',
    });
  } catch (error) {
    console.error('Error updating artist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update artist' },
      { status: 500 }
    );
  }
}
