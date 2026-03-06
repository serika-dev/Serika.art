import axios from 'axios';
import { cookies, headers } from 'next/headers';

const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.serika.dev';
const ACCOUNTS_INTERNAL_KEY = process.env.ACCOUNTS_INTERNAL_KEY!;

export type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rank?: UserRank;
  isPremium?: boolean;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // Check for token in cookie first, then Authorization header (for mobile apps)
    const cookieStore = await cookies();
    let sessionToken = cookieStore.get('session_token')?.value;

    // If no cookie, check Authorization header (Bearer token)
    if (!sessionToken) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7);
      }
    }

    if (!sessionToken) {
      return null;
    }

    // Verify token with Serika Accounts using internal endpoint
    const verifyResponse = await axios.post(
      `${ACCOUNTS_URL}/internal/verify`,
      {
        token: sessionToken,
        checkBan: true,
      },
      {
        headers: {
          'X-Service-Key': ACCOUNTS_INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verifyResponse.data.valid || !verifyResponse.data.user) {
      return null;
    }

    const userId = verifyResponse.data.user.id;

    // Fetch full user details
    const userResponse = await axios.post(
      `${ACCOUNTS_URL}/internal/get-user`,
      {
        id: userId,
      },
      {
        headers: {
          'X-Service-Key': ACCOUNTS_INTERNAL_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (userResponse.data.success && userResponse.data.user) {
      // Fetch rank from local DB
      const { getCollection } = await import('@/lib/db');
      const { ObjectId } = await import('mongodb');
      const usersCollection = await getCollection('users');
      const localUser = await usersCollection.findOne({ 
        _id: new ObjectId(userResponse.data.user.id) 
      });
      
      return {
        id: userResponse.data.user.id || userResponse.data.user._id,
        username: userResponse.data.user.username,
        email: userResponse.data.user.email,
        avatarUrl: userResponse.data.user.avatar,
        rank: localUser?.rank || 'user',
        isPremium: userResponse.data.user.isPremium || false,
      };
    }

    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
