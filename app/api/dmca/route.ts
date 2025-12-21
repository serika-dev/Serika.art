import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { sendEmail, emailTemplates } from '@/lib/email';
import { getCurrentUser } from '@/lib/auth';

// POST /api/dmca - Submit a DMCA request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      claimantName,
      email,
      address,
      phone,
      copyrightedWork,
      infringingUrls,
      goodFaithStatement,
      perjuryStatement,
      electronicSignature,
      additionalInfo
    } = body;

    // Validate required fields
    if (!claimantName || !email || !copyrightedWork || !infringingUrls || !goodFaithStatement || !perjuryStatement || !electronicSignature) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    const collection = await getCollection('dmca_requests');

    const dmcaRequest = {
      claimantName,
      email,
      address: address || null,
      phone: phone || null,
      copyrightedWork,
      infringingUrls,
      goodFaithStatement,
      perjuryStatement,
      electronicSignature,
      additionalInfo: additionalInfo || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      notes: [],
      affectedImageIds: [],
    };

    const result = await collection.insertOne(dmcaRequest);

    // Send confirmation email
    const template = emailTemplates.dmcaConfirmation(claimantName);
    await sendEmail({
      to: email,
      subject: template.subject,
      text: template.text,
      from: 'Serika Legal <no-reply@serika.email>',
    });

    // Notify legal team
    await sendEmail({
      to: 'legal@serika.dev',
      subject: `[DMCA] New Takedown Request from ${claimantName}`,
      text: `New DMCA takedown request has been submitted.\n\nFrom: ${claimantName} (${email})\nRequest ID: ${result.insertedId.toString()}\n\nPlease review in the admin panel.`,
      from: 'Serika Legal <no-reply@serika.email>',
      replyTo: email,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'DMCA request submitted successfully',
      requestId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('DMCA submission error:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 });
  }
}

// GET /api/dmca - Get DMCA requests (admin only)
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const user = await getCurrentUser();
    
    if (!user || !['admin', 'owner', 'moderator'].includes(user.rank || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const collection = await getCollection('dmca_requests');
    
    const query: any = {};
    if (status) {
      query.status = status;
    }

    const total = await collection.countDocuments(query);
    const requests = await collection
      .find(query)
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('DMCA fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
  }
}
