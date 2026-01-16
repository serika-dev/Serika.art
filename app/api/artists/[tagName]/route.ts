import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Get artist by tag name
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const { tagName } = await params;
    // Next.js automatically decodes URL parameters, so tagName is already decoded
    const normalized = tagName.toLowerCase().trim();
    // Create variations with both spaces and underscores to match database storage
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));

    // First, check if the tag exists and is an artist tag
    const tagsCollection = await getCollection('tags');
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist tag not found' },
        { status: 404 }
      );
    }

    // Check if artist page exists
    const artistsCollection = await getCollection('artists');
    let artist = await artistsCollection.findOne({ tagId: tag._id });

    // If no artist page exists, create one (unclaimed)
    if (!artist) {
      const newArtist = {
        tagId: tag._id,
        tagName: tag.name,
        verified: false,
        socials: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const result = await artistsCollection.insertOne(newArtist);
      artist = { ...newArtist, _id: result.insertedId };
    }

    // Get image count for this artist
    const imagesCollection = await getCollection('images');
    const imageCount = await imagesCollection.countDocuments({
      tags: tag._id,
      deleted: { $ne: true }
    });

    // Get some sample images
    const sampleImages = await imagesCollection
      .find({ tags: tag._id, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    return NextResponse.json({
      success: true,
      artist: {
        _id: artist!._id.toString(),
        tagId: artist!.tagId.toString(),
        tagName: artist!.tagName,
        claimedByUserId: artist!.claimedByUserId?.toString(),
        claimedByUsername: artist!.claimedByUsername,
        verified: artist!.verified,
        avatarUrl: artist!.avatarUrl,
        bannerUrl: artist!.bannerUrl,
        bio: artist!.bio,
        socials: artist!.socials || {},
        createdAt: artist!.createdAt,
        updatedAt: artist!.updatedAt,
      },
      tag: {
        _id: tag._id.toString(),
        name: tag.name,
        type: tag.type,
        count: tag.count,
      },
      imageCount,
      sampleImages: sampleImages.map(img => ({
        _id: img._id.toString(),
        sequentialId: img.sequentialId,
        thumbnailUrl: img.thumbnailUrl || img.url,
        url: img.url,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching artist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artist' },
      { status: 500 }
    );
  }
}

// Update artist profile (only for verified owners)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in' },
        { status: 401 }
      );
    }

    const { tagName } = await params;
    // Next.js automatically decodes URL parameters, so tagName is already decoded
    const normalized = tagName.toLowerCase().trim();
    // Create variations with both spaces and underscores to match database storage
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));
    const body = await request.json();
    const { bio, socials, avatarUrl, bannerUrl } = body;

    const tagsCollection = await getCollection('tags');
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist tag not found' },
        { status: 404 }
      );
    }

    const artistsCollection = await getCollection('artists');
    const artist = await artistsCollection.findOne({ tagId: tag._id });

    if (!artist) {
      return NextResponse.json(
        { success: false, error: 'Artist page not found' },
        { status: 404 }
      );
    }

    // Check if user is the verified owner or admin
    const isOwner = artist.claimedByUserId?.toString() === user.id && artist.verified;
    const isAdmin = user.rank === 'admin' || user.rank === 'owner';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to edit this artist page' },
        { status: 403 }
      );
    }

    // Validate socials
    const validSocials = ['twitter', 'bluesky', 'youtube', 'pixiv', 'deviantart', 'artstation', 'patreon', 'linktree', 'carrd', 'website', 'skeb'];
    const cleanedSocials: any = {};
    if (socials && typeof socials === 'object') {
      for (const key of validSocials) {
        if (socials[key] && typeof socials[key] === 'string') {
          cleanedSocials[key] = socials[key].trim();
        }
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (bio !== undefined) {
      updateData.bio = bio?.trim() || '';
    }
    if (Object.keys(cleanedSocials).length > 0 || socials === null) {
      updateData.socials = cleanedSocials;
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || undefined;
    }
    if (bannerUrl !== undefined) {
      updateData.bannerUrl = bannerUrl || undefined;
    }

    await artistsCollection.updateOne(
      { _id: artist._id },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: 'Artist profile updated',
    });
  } catch (error: any) {
    console.error('Error updating artist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update artist' },
      { status: 500 }
    );
  }
}
