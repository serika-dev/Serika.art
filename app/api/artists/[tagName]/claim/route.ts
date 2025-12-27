import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Word lists for generating verification phrases
const adjectives = [
  'red', 'blue', 'green', 'purple', 'golden', 'silver', 'crystal', 'ancient',
  'swift', 'bright', 'dark', 'silent', 'gentle', 'wild', 'cosmic', 'mystic',
  'frozen', 'burning', 'dancing', 'sleeping', 'hidden', 'sacred', 'eternal', 'lunar',
  'solar', 'stellar', 'rainbow', 'shadow', 'glowing', 'floating', 'singing', 'dreaming'
];

const nouns = [
  'phoenix', 'dragon', 'unicorn', 'tiger', 'wolf', 'falcon', 'owl', 'fox',
  'moon', 'star', 'sun', 'cloud', 'river', 'mountain', 'forest', 'ocean',
  'crystal', 'diamond', 'emerald', 'ruby', 'sapphire', 'pearl', 'opal', 'jade',
  'thunder', 'lightning', 'storm', 'wind', 'flame', 'wave', 'garden', 'castle'
];

function generateVerificationWords(): string[] {
  const words: string[] = [];
  const usedAdjectives = new Set<number>();
  const usedNouns = new Set<number>();
  
  for (let i = 0; i < 2; i++) {
    let adjIndex: number;
    do {
      adjIndex = Math.floor(Math.random() * adjectives.length);
    } while (usedAdjectives.has(adjIndex));
    usedAdjectives.add(adjIndex);
    
    let nounIndex: number;
    do {
      nounIndex = Math.floor(Math.random() * nouns.length);
    } while (usedNouns.has(nounIndex));
    usedNouns.add(nounIndex);
    
    words.push(adjectives[adjIndex], nouns[nounIndex]);
  }
  
  return words;
}

// Create a claim request
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
    const decoded = decodeURIComponent(tagName).toLowerCase();
    const possibleNames = Array.from(new Set([
      decoded,
      decoded.replace(/ /g, '_'),
      decoded.replace(/_/g, ' '),
    ]));
    const body = await request.json();
    const { verificationMethod, additionalInfo, discordId, contactEmailOnly, artworkLink, psdFileUrl } = body;

    if (!verificationMethod || !['social', 'website', 'dm', 'psd'].includes(verificationMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification method' },
        { status: 400 }
      );
    }

    // Check if tag exists and is an artist tag
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

    // Check if artist is already claimed
    const artistsCollection = await getCollection('artists');
    const artist = await artistsCollection.findOne({ tagId: tag._id });

    if (artist?.verified && artist?.claimedByUserId) {
      return NextResponse.json(
        { success: false, error: 'This artist page has already been claimed' },
        { status: 400 }
      );
    }

    // Check if user already has a pending claim for this artist
    const claimsCollection = await getCollection('artistClaims');
    const existingClaim = await claimsCollection.findOne({
      artistTagId: tag._id,
      userId: new ObjectId(user.id),
      status: 'pending'
    });

    if (existingClaim) {
      return NextResponse.json({
        success: true,
        message: 'You already have a pending claim for this artist',
        claim: {
          _id: existingClaim._id.toString(),
          verificationWords: existingClaim.verificationWords,
          verificationMethod: existingClaim.verificationMethod,
          status: existingClaim.status,
          createdAt: existingClaim.createdAt,
        }
      });
    }

    // Get user details
    const usersCollection = await getCollection('users');
    const userDoc = await usersCollection.findOne({ _id: new ObjectId(user.id) });

    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate verification words
    const verificationWords = generateVerificationWords();

    // Create claim
    const claim = {
      artistTagId: tag._id,
      artistTagName: tag.name,
      userId: new ObjectId(user.id),
      username: userDoc.username,
      userEmail: userDoc.email,
      verificationWords,
      verificationMethod,
      additionalInfo: additionalInfo?.trim() || undefined,
      discordId: contactEmailOnly ? undefined : (discordId?.trim() || undefined),
      contactEmailOnly: contactEmailOnly || false,
      artworkLink: verificationMethod === 'psd' ? (artworkLink?.trim() || undefined) : undefined,
      psdFileUrl: verificationMethod === 'psd' ? (psdFileUrl || undefined) : undefined,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await claimsCollection.insertOne(claim);

    return NextResponse.json({
      success: true,
      message: 'Claim submitted successfully',
      claim: {
        _id: result.insertedId.toString(),
        verificationWords,
        verificationMethod,
        status: 'pending',
        createdAt: claim.createdAt,
      }
    });
  } catch (error: any) {
    console.error('Error creating artist claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create claim' },
      { status: 500 }
    );
  }
}

// Get user's claim status for this artist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        claim: null,
      });
    }

    const { tagName } = await params;
    const decoded = decodeURIComponent(tagName).toLowerCase();
    const possibleNames = Array.from(new Set([
      decoded,
      decoded.replace(/ /g, '_'),
      decoded.replace(/_/g, ' '),
    ]));

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

    const claimsCollection = await getCollection('artistClaims');
    const claim = await claimsCollection.findOne({
      artistTagId: tag._id,
      userId: new ObjectId(user.id),
    }, {
      sort: { createdAt: -1 }
    });

    if (!claim) {
      return NextResponse.json({
        success: true,
        claim: null,
      });
    }

    return NextResponse.json({
      success: true,
      claim: {
        _id: claim._id.toString(),
        verificationWords: claim.verificationWords,
        verificationMethod: claim.verificationMethod,
        status: claim.status,
        reviewNotes: claim.reviewNotes,
        createdAt: claim.createdAt,
        reviewedAt: claim.reviewedAt,
      }
    });
  } catch (error: any) {
    console.error('Error fetching claim status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch claim status' },
      { status: 500 }
    );
  }
}
