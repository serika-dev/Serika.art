import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import axios from 'axios';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

// GET reviews for an artist
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

    const tagsCollection = await getCollection('tags');
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const reviewsCollection = await getCollection('artistReviews');
    const reviews = await reviewsCollection
      .find({ artistTagId: tag._id })
      .sort({ createdAt: -1 })
      .toArray();

    // Get user avatars from accounts API
    const userIds = [...new Set(reviews.map(r => r.userId?.toString()).filter(Boolean))];
    const avatarMap = new Map<string, string>();
    
    // Fetch avatars from accounts API in parallel
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const userRes = await axios.post(
            `${ACCOUNTS_URL}/internal/get-user`,
            { id: userId },
            {
              headers: {
                'x-service-key': ACCOUNTS_INTERNAL_KEY,
                'Content-Type': 'application/json',
              },
              timeout: 5000,
            }
          );
          if (userRes.data.success && userRes.data.user?.avatar) {
            avatarMap.set(userId, userRes.data.user.avatar);
          }
        } catch {
          // Silently fail if accounts API is unavailable for this user
        }
      })
    );

    // Calculate average ratings
    let avgRatings = { trust: 0, quality: 0, communication: 0, pricing: 0 };
    let pricingCount = 0;
    
    if (reviews.length > 0) {
      for (const review of reviews) {
        avgRatings.trust += review.ratings.trust;
        avgRatings.quality += review.ratings.quality;
        avgRatings.communication += review.ratings.communication;
        if (review.ratings.pricing) {
          avgRatings.pricing += review.ratings.pricing;
          pricingCount++;
        }
      }
      avgRatings.trust = Math.round((avgRatings.trust / reviews.length) * 10) / 10;
      avgRatings.quality = Math.round((avgRatings.quality / reviews.length) * 10) / 10;
      avgRatings.communication = Math.round((avgRatings.communication / reviews.length) * 10) / 10;
      if (pricingCount > 0) {
        avgRatings.pricing = Math.round((avgRatings.pricing / pricingCount) * 10) / 10;
      }
    }

    return NextResponse.json({
      success: true,
      reviews: reviews.map(r => {
        return {
          _id: r._id.toString(),
          username: r.username,
          avatarUrl: r.userId ? avatarMap.get(r.userId.toString()) : undefined,
          ratings: r.ratings,
          comment: r.comment,
          createdAt: r.createdAt,
        };
      }),
      avgRatings,
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST a new review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tagName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in to review' },
        { status: 401 }
      );
    }

    const { tagName } = await params;
    // Next.js automatically decodes URL parameters, so tagName is already decoded
    const normalized = tagName.toLowerCase().trim();
    const body = await request.json();
    const { ratings, comment } = body;

    // Validate ratings
    if (!ratings || typeof ratings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Ratings are required' },
        { status: 400 }
      );
    }

    const requiredRatings = ['trust', 'quality', 'communication'];
    for (const key of requiredRatings) {
      const val = ratings[key];
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return NextResponse.json(
          { success: false, error: `${key} rating must be 1-5` },
          { status: 400 }
        );
      }
    }

    if (ratings.pricing !== undefined) {
      if (typeof ratings.pricing !== 'number' || ratings.pricing < 1 || ratings.pricing > 5) {
        return NextResponse.json(
          { success: false, error: 'pricing rating must be 1-5' },
          { status: 400 }
        );
      }
    }

    const tagsCollection = await getCollection('tags');
    // Create variations with both spaces and underscores to match database storage
    const possibleNames = Array.from(new Set([
      normalized,
      normalized.replace(/ /g, '_'),
      normalized.replace(/_/g, ' '),
    ]));
    const tag = await tagsCollection.findOne({ 
      name: { $in: possibleNames },
      type: 'artist'
    });

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'Artist not found' },
        { status: 404 }
      );
    }

    const reviewsCollection = await getCollection('artistReviews');
    
    // Check if user already reviewed
    const existingReview = await reviewsCollection.findOne({
      artistTagId: tag._id,
      userId: new ObjectId(user.id),
    });

    if (existingReview) {
      // Update existing review
      await reviewsCollection.updateOne(
        { _id: existingReview._id },
        {
          $set: {
            ratings: {
              trust: Math.round(ratings.trust),
              quality: Math.round(ratings.quality),
              communication: Math.round(ratings.communication),
              ...(ratings.pricing && { pricing: Math.round(ratings.pricing) }),
            },
            comment: comment?.trim() || undefined,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Review updated',
      });
    }

    // Create new review
    await reviewsCollection.insertOne({
      artistTagId: tag._id,
      artistTagName: tag.name,
      userId: new ObjectId(user.id),
      username: user.username,
      ratings: {
        trust: Math.round(ratings.trust),
        quality: Math.round(ratings.quality),
        communication: Math.round(ratings.communication),
        ...(ratings.pricing && { pricing: Math.round(ratings.pricing) }),
      },
      comment: comment?.trim() || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Review submitted',
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}
