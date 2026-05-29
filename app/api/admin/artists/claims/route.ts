import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

async function checkAdmin() {
  const user = await getCurrentUser();
  if (!user) return null;
  const result = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
  const rank = result.rows[0]?.rank;
  if (rank === 'admin' || rank === 'owner') return { ...user, rank };
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const claims = await query(
      `SELECT * FROM artist_claims WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    );

    return NextResponse.json({
      success: true,
      claims: claims.rows.map(c => ({
        _id: String(c.id),
        artistTagId: String(c.artist_tag_id),
        artistTagName: c.artist_tag_name,
        userId: c.user_id,
        username: c.username,
        userEmail: c.user_email,
        verificationWords: c.verification_words,
        verificationMethod: c.verification_method,
        additionalInfo: c.additional_info,
        proofFileUrl: c.proof_file_url,
        status: c.status,
        reviewedBy: c.reviewed_by,
        reviewedByUsername: c.reviewed_by_username,
        reviewNotes: c.review_notes,
        reviewedAt: c.reviewed_at,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await checkAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

    const { claimId, action, reviewNotes } = await request.json();

    if (!claimId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const claimResult = await query(`SELECT * FROM artist_claims WHERE id = $1`, [parseInt(claimId)]);
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 });
    }

    const claim = claimResult.rows[0];
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await query(
      `UPDATE artist_claims SET status = $1, reviewed_by = $2, reviewed_by_username = $3,
       review_notes = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $5`,
      [newStatus, admin.id, admin.username, reviewNotes || null, claim.id]
    );

    if (action === 'approve') {
      await query(
        `INSERT INTO artists (tag_id, tag_name, claimed_by_user_id, claimed_by_username, verified, socials, created_at, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, '{}', NOW(), NOW())
         ON CONFLICT (tag_id) DO UPDATE SET
           claimed_by_user_id = $3, claimed_by_username = $4, verified = TRUE, updated_at = NOW()`,
        [claim.artist_tag_id, claim.artist_tag_name, claim.user_id, claim.username]
      );
    }

    return NextResponse.json({ success: true, message: `Claim ${newStatus}` });
  } catch (error) {
    console.error('Error updating claim:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
