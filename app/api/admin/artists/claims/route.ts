import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Admin: Get all artist claims
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.rank !== 'admin' && user.rank !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const claimsCollection = await getCollection('artistClaims');
    
    const filter: any = {};
    if (status !== 'all') {
      filter.status = status;
    }

    const total = await claimsCollection.countDocuments(filter);
    const claims = await claimsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      claims: claims.map(claim => ({
        _id: claim._id.toString(),
        artistTagId: claim.artistTagId.toString(),
        artistTagName: claim.artistTagName,
        userId: claim.userId.toString(),
        username: claim.username,
        userEmail: claim.userEmail,
        verificationWords: claim.verificationWords,
        verificationMethod: claim.verificationMethod,
        additionalInfo: claim.additionalInfo,
        discordId: claim.discordId,
        contactEmailOnly: claim.contactEmailOnly,
        artworkLink: claim.artworkLink,
        psdFileUrl: claim.psdFileUrl,
        status: claim.status,
        reviewedBy: claim.reviewedBy?.toString(),
        reviewedByUsername: claim.reviewedByUsername,
        reviewNotes: claim.reviewNotes,
        reviewedAt: claim.reviewedAt,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    console.error('Error fetching artist claims:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}

// Admin: Review a claim (approve/reject)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.rank !== 'admin' && user.rank !== 'owner')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { claimId, action, reviewNotes } = body;

    if (!claimId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const claimsCollection = await getCollection('artistClaims');
    const claim = await claimsCollection.findOne({ _id: new ObjectId(claimId) });

    if (!claim) {
      return NextResponse.json(
        { success: false, error: 'Claim not found' },
        { status: 404 }
      );
    }

    if (claim.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This claim has already been reviewed' },
        { status: 400 }
      );
    }

    // Get reviewer details
    const usersCollection = await getCollection('users');
    const reviewer = await usersCollection.findOne({ _id: new ObjectId(user.id) });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update claim
    await claimsCollection.updateOne(
      { _id: claim._id },
      {
        $set: {
          status: newStatus,
          reviewedBy: new ObjectId(user.id),
          reviewedByUsername: reviewer?.username || user.username,
          reviewNotes: reviewNotes?.trim() || undefined,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        }
      }
    );

    // If approved, update the artist page
    if (action === 'approve') {
      const artistsCollection = await getCollection('artists');
      
      // Get or create artist page
      let artist = await artistsCollection.findOne({ tagId: claim.artistTagId });
      
      if (artist) {
        await artistsCollection.updateOne(
          { _id: artist._id },
          {
            $set: {
              claimedByUserId: claim.userId,
              claimedByUsername: claim.username,
              verified: true,
              updatedAt: new Date(),
            }
          }
        );
      } else {
        await artistsCollection.insertOne({
          tagId: claim.artistTagId,
          tagName: claim.artistTagName,
          claimedByUserId: claim.userId,
          claimedByUsername: claim.username,
          verified: true,
          socials: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Send email notification to the claimant
    try {
      const claimantUser = await usersCollection.findOne({ _id: claim.userId });
      if (claimantUser?.email) {
        const { sendEmail, emailTemplates } = await import('@/lib/email');
        const artistDisplayName = claim.artistTagName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        
        if (action === 'approve') {
          const emailContent = emailTemplates.claimApproved(claim.username, artistDisplayName);
          await sendEmail({
            to: claimantUser.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        } else {
          const emailContent = emailTemplates.claimRejected(claim.username, artistDisplayName, reviewNotes);
          await sendEmail({
            to: claimantUser.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }
      }
    } catch (emailError) {
      console.error('Failed to send claim notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error: any) {
    console.error('Error reviewing artist claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review claim' },
      { status: 500 }
    );
  }
}
