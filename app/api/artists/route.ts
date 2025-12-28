import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Get all artists or search for artists
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const verified = searchParams.get('verified');

    const collection = await getCollection('artists');
    
    const filter: any = {};
    
    if (query) {
      filter.tagName = { $regex: query, $options: 'i' };
    }
    
    if (verified === 'true') {
      filter.verified = true;
    } else if (verified === 'false') {
      filter.verified = false;
    }

    const artists = await collection
      .find(filter)
      .sort({ tagName: 1 })
      .collation({ locale: 'en', strength: 2 }) // Case-insensitive sorting
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      artists: artists.map(artist => ({
        _id: artist._id.toString(),
        tagId: artist.tagId.toString(),
        tagName: artist.tagName,
        claimedByUserId: artist.claimedByUserId?.toString(),
        claimedByUsername: artist.claimedByUsername,
        verified: artist.verified,
        avatarUrl: artist.avatarUrl,
        bannerUrl: artist.bannerUrl,
        bio: artist.bio,
        socials: artist.socials || {},
        createdAt: artist.createdAt,
        updatedAt: artist.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching artists:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}
