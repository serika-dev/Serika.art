import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to claim an artist page' },
        { status: 401 }
      );
    }

    const { tagName } = await params;
    const normalized = tagName.toLowerCase().trim();
    const possibleNames = Array.from(new Set([
      normalized, normalized.replace(/ /g, '_'), normalized.replace(/_/g, ' '),
    ]));

    const body = await request.json();
    const { verificationMethod, additionalInfo, proofFileUrl } = body;

    const tagResult = await query(
      `SELECT * FROM tags WHERE name = ANY($1) AND type = 'artist'`,
      [possibleNames]
    );

    if (tagResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Artist tag not found' },
        { status: 404 }
      );
    }

    const tag = tagResult.rows[0];

    // Check if already claimed
    const existingArtist = await query(
      `SELECT * FROM artists WHERE tag_id = $1 AND verified = TRUE`,
      [tag.id]
    );

    if (existingArtist.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'This artist page has already been claimed' },
        { status: 409 }
      );
    }

    // Check for existing pending claim by this user
    const existingClaim = await query(
      `SELECT id FROM artist_claims WHERE artist_tag_id = $1 AND user_id = $2 AND status = 'pending'`,
      [tag.id, user.id]
    );

    if (existingClaim.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending claim for this artist' },
        { status: 409 }
      );
    }

    // Generate verification words
    const words = ['art', 'serika', 'verify', 'claim', 'artist', 'digital', 'paint', 'draw',
      'canvas', 'brush', 'color', 'sketch', 'design', 'pixel', 'create', 'studio'];
    const verificationWords = Array.from({ length: 4 }, () =>
      words[Math.floor(Math.random() * words.length)]
    );

    // Create claim
    const claimResult = await query(
      `INSERT INTO artist_claims (
        artist_tag_id, artist_tag_name, user_id, username, user_email,
        verification_words, verification_method, additional_info, proof_file_url,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())
      RETURNING *`,
      [tag.id, tag.name, user.id, user.username, user.email || '',
       verificationWords, verificationMethod || 'social',
       additionalInfo || null, proofFileUrl || null]
    );

    // Ensure artist row exists (unverified placeholder)
    await query(
      `INSERT INTO artists (tag_id, tag_name, verified, socials, created_at, updated_at)
       VALUES ($1, $2, FALSE, '{}', NOW(), NOW())
       ON CONFLICT (tag_id) DO NOTHING`,
      [tag.id, tag.name]
    );

    return NextResponse.json({
      success: true,
      claim: {
        _id: String(claimResult.rows[0].id),
        verificationWords,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Error creating artist claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create claim' },
      { status: 500 }
    );
  }
}
