import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    // Try local DB first
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    
    const localUser = await usersCollection.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    if (localUser) {
      // Try to get additional data from accounts API using user ID
      let accountsData = null;
      try {
        const userRes = await axios.post(
          `${ACCOUNTS_URL}/internal/get-user`,
          { id: localUser._id.toString() },
          {
            headers: {
              'x-service-key': ACCOUNTS_INTERNAL_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );

        if (userRes.data.success && userRes.data.user) {
          accountsData = userRes.data.user;
        }
      } catch (accountsError) {
        // Silently fail if accounts API is unavailable
      }

      return NextResponse.json({
        success: true,
        user: {
          id: localUser._id.toString(),
          username: localUser.username,
          avatarUrl: accountsData?.avatar || localUser.avatarUrl,
          bannerUrl: accountsData?.banner,
          rank: localUser.rank || 'user',
          createdAt: localUser.createdAt,
          isPremium: accountsData?.isPremium || false,
          isVerified: accountsData?.isVerified || false,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'User not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
