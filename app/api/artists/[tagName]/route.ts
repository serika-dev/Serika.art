import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));

    const tagResult = await query(
      `SELECT * FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const tag = tagResult.rows[0];

    const artistResult = await query(
      `SELECT * FROM artists WHERE tag_id = $1`,
      [tag.id]
    );

    const artist = artistResult.rows[0] || null;

    // Get reviews summary
    const reviewsResult = await query(
      `SELECT
        COUNT(*) as review_count,
        AVG((ratings->>'trust')::numeric) as avg_trust,
        AVG((ratings->>'quality')::numeric) as avg_quality,
        AVG((ratings->>'communication')::numeric) as avg_communication,
        AVG((ratings->>'pricing')::numeric) as avg_pricing
       FROM artist_reviews
       WHERE artist_tag_id = $1`,
      [tag.id]
    );

    const reviewSummary = reviewsResult.rows[0];

    return NextResponse.json({
      success: true,
      tag: {
        _id: String(tag.id),
        id: tag.id,
        name: tag.name,
        type: tag.type,
        count: tag.count,
      },
      artist: artist ? {
        _id: String(artist.id),
        tagId: String(artist.tag_id),
        tagName: artist.tag_name,
        claimedByUserId: artist.claimed_by_user_id,
        claimedByUsername: artist.claimed_by_username,
        verified: artist.verified,
        avatarUrl: artist.avatar_url,
        bannerUrl: artist.banner_url,
        bio: artist.bio,
        socials: artist.socials || {},
        createdAt: artist.created_at,
      } : null,
      reviews: {
        count: parseInt(reviewSummary?.review_count || '0'),
        averages: {
          trust: parseFloat(reviewSummary?.avg_trust || '0'),
          quality: parseFloat(reviewSummary?.avg_quality || '0'),
          communication: parseFloat(reviewSummary?.avg_communication || '0'),
          pricing: reviewSummary?.avg_pricing ? parseFloat(reviewSummary.avg_pricing) : null,
        },
      },
    });
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
