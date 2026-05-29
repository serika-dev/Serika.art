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
      normalized, normalized.replace(/ /g, '_'), normalized.replace(/_/g, ' '),
    ]));

    const tagResult = await query(
      `SELECT id FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    const reviews = await query(
      `SELECT * FROM artist_reviews WHERE artist_tag_id = $1 ORDER BY created_at DESC`,
      [tagResult.rows[0].id]
    );

    return NextResponse.json({
      success: true,
      reviews: reviews.rows.map(r => ({
        _id: String(r.id),
        userId: r.user_id,
        username: r.username,
        ratings: r.ratings,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
    }

    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized, normalized.replace(/ /g, '_'), normalized.replace(/_/g, ' '),
    ]));
    const body = await request.json();
    const { ratings, comment } = body;

    if (!ratings || typeof ratings !== 'object') {
      return NextResponse.json({ success: false, error: 'Ratings are required' }, { status: 400 });
    }

    for (const key of ['trust', 'quality', 'communication']) {
      const val = ratings[key];
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return NextResponse.json({ success: false, error: `${key} rating must be 1-5` }, { status: 400 });
      }
    }

    if (ratings.pricing !== undefined && (typeof ratings.pricing !== 'number' || ratings.pricing < 1 || ratings.pricing > 5)) {
      return NextResponse.json({ success: false, error: 'pricing rating must be 1-5' }, { status: 400 });
    }

    const tagResult = await query(
      `SELECT id, name FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    const tag = tagResult.rows[0];
    const ratingsJson = {
      trust: Math.round(ratings.trust),
      quality: Math.round(ratings.quality),
      communication: Math.round(ratings.communication),
      ...(ratings.pricing && { pricing: Math.round(ratings.pricing) }),
    };

    await query(
      `INSERT INTO artist_reviews (artist_tag_id, artist_tag_name, user_id, username, ratings, comment, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (artist_tag_id, user_id) DO UPDATE SET
         ratings = $5, comment = $6, updated_at = NOW()`,
      [tag.id, tag.name, user.id, user.username, JSON.stringify(ratingsJson), comment?.trim() || null]
    );

    return NextResponse.json({ success: true, message: 'Review submitted' });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit review' }, { status: 500 });
  }
}
