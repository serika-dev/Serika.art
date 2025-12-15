import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import {
  generateApiKey,
  hashApiKey,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  ApiPermission,
} from '@/lib/apiAuth';

// GET - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const collection = await getCollection('api_keys');
    const keys = await collection
      .find({ userId: new ObjectId(user.id) })
      .project({
        key: 0, // Never return the actual key
        keyHash: 0,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      keys,
    });
  } catch (error: any) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name = 'API Key',
      permissions = DEFAULT_PERMISSIONS,
      rateLimit = 60,
      expiresIn, // in days
    } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid key name' },
        { status: 400 }
      );
    }

    // Validate permissions
    const validPermissions = permissions.filter((p: string) =>
      ALL_PERMISSIONS.includes(p as ApiPermission)
    );

    // Check user rank for certain permissions
    const usersCollection = await getCollection('users');
    const localUser = await usersCollection.findOne({
      _id: new ObjectId(user.id),
    });
    
    const userRank = localUser?.rank || 'user';
    
    // Only moderators+ can get upload permission via API
    if (validPermissions.includes('upload') && !['moderator', 'admin', 'owner'].includes(userRank)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges for upload permission' },
        { status: 403 }
      );
    }

    // Only admins+ can get delete permission
    if (validPermissions.includes('images:delete') && !['admin', 'owner'].includes(userRank)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges for delete permission' },
        { status: 403 }
      );
    }

    // Limit number of API keys per user
    const collection = await getCollection('api_keys');
    const existingCount = await collection.countDocuments({
      userId: new ObjectId(user.id),
    });

    const maxKeys = userRank === 'owner' ? 50 : userRank === 'admin' ? 20 : 5;
    if (existingCount >= maxKeys) {
      return NextResponse.json(
        { success: false, error: `Maximum of ${maxKeys} API keys allowed` },
        { status: 400 }
      );
    }

    // Generate key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Calculate expiration
    let expiresAt: Date | undefined;
    if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);
    }

    // Validate rate limit (min 10, max 1000 for regular users)
    const maxRateLimit = userRank === 'owner' ? 10000 : userRank === 'admin' ? 1000 : 120;
    const finalRateLimit = Math.min(Math.max(10, rateLimit), maxRateLimit);

    const keyDoc = {
      userId: new ObjectId(user.id),
      username: user.username,
      name,
      keyHash,
      permissions: validPermissions,
      rateLimit: finalRateLimit,
      usageCount: 0,
      expiresAt,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(keyDoc);

    return NextResponse.json({
      success: true,
      key: {
        _id: result.insertedId,
        name,
        apiKey, // Only returned once at creation!
        permissions: validPermissions,
        rateLimit: finalRateLimit,
        expiresAt,
        createdAt: keyDoc.createdAt,
      },
      message: 'Save this API key securely - it will not be shown again!',
    });
  } catch (error: any) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId || !ObjectId.isValid(keyId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid key ID' },
        { status: 400 }
      );
    }

    const collection = await getCollection('api_keys');
    
    // Check ownership
    const key = await collection.findOne({
      _id: new ObjectId(keyId),
    });

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    // Allow deletion if owner of key OR admin+
    const usersCollection = await getCollection('users');
    const localUser = await usersCollection.findOne({
      _id: new ObjectId(user.id),
    });
    const userRank = localUser?.rank || 'user';

    if (key.userId.toString() !== user.id && !['admin', 'owner'].includes(userRank)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this key' },
        { status: 403 }
      );
    }

    await collection.deleteOne({ _id: new ObjectId(keyId) });

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
