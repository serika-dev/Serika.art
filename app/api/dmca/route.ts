import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendEmail, emailTemplates } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId, reporterName, reporterEmail, reporterRelationship, description, originalUrl } = body;

    if (!reporterName || !reporterEmail || !description) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const sequentialId = parseInt(imageId, 10);
    let imageDbId: number | null = null;

    if (!isNaN(sequentialId)) {
      const imgResult = await query(`SELECT id FROM images WHERE sequential_id = $1`, [sequentialId]);
      if (imgResult.rows.length > 0) imageDbId = imgResult.rows[0].id;
    }

    const result = await query(
      `INSERT INTO dmca_requests (image_id, image_sequential_id, reporter_name, reporter_email,
       reporter_relationship, description, original_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW()) RETURNING id`,
      [imageDbId, isNaN(sequentialId) ? null : sequentialId, reporterName, reporterEmail,
       reporterRelationship || null, description, originalUrl || null]
    );

    // Send notification email
    try {
      await sendEmail({
        to: 'pikachu@serika.dev',
        subject: `DMCA Takedown Request #${result.rows[0].id}`,
        text: `New DMCA request from ${reporterName} (${reporterEmail})\nImage: ${imageId}\nDescription: ${description}`,
        from: 'Serika DMCA <no-reply@serika.email>',
      });
    } catch (e) {
      console.error('Failed to send DMCA notification email:', e);
    }

    return NextResponse.json({
      success: true,
      requestId: String(result.rows[0].id),
      message: 'DMCA request submitted',
    });
  } catch (error) {
    console.error('Error creating DMCA request:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getCurrentUser } = await import('@/lib/auth');
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const userResult = await query(`SELECT rank FROM users WHERE id = $1`, [user.id]);
    if (!['admin', 'owner'].includes(userResult.rows[0]?.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(`SELECT * FROM dmca_requests ORDER BY created_at DESC LIMIT 100`);

    return NextResponse.json({
      success: true,
      requests: result.rows.map(r => ({
        _id: String(r.id),
        imageId: r.image_id,
        imageSequentialId: r.image_sequential_id,
        reporterName: r.reporter_name,
        reporterEmail: r.reporter_email,
        description: r.description,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
