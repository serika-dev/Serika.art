import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
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

    const result = await query(
      `SELECT id, user_id, username, name, permissions, rate_limit, usage_count,
              last_used_at, expires_at, is_active, created_at, updated_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    const keys = result.rows.map(k => ({
      _id: String(k.id),
      id: k.id,
      userId: k.user_id,
      username: k.username,
      name: k.name,
      permissions: k.permissions,
      rateLimit: k.rate_limit,
      usageCount: k.usage_count,
      lastUsedAt: k.last_used_at,
      expiresAt: k.expires_at,
      isActive: k.is_active,
      createdAt: k.created_at,
      updatedAt: k.updated_at,
    }));

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

    // Get user details
    const localUserResult = await query(
      `SELECT rank FROM users WHERE id = $1`,
      [user.id]
    );
    const localUser = localUserResult.rows[0];
    const userRank = localUser?.rank || 'user';
    const isPremium = false; // Add premium logic if there is any

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
    const existingCountResult = await query(
      `SELECT COUNT(*) as count FROM api_keys WHERE user_id = $1`,
      [user.id]
    );
    const existingCount = parseInt(existingCountResult.rows[0].count, 10);

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
    let expiresAt: Date | null = null;
    if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);
    }

    // Validate rate limit (min 10, max based on rank/premium)
    const maxRateLimit = userRank === 'owner' ? 10000 : userRank === 'admin' ? 1000 : (userRank === 'moderator' || isPremium) ? 120 : 60;
    const finalRateLimit = Math.min(Math.max(10, rateLimit), maxRateLimit);

    const keyResult = await query(
      `INSERT INTO api_keys (user_id, username, name, key_hash, permissions, rate_limit,
                            usage_count, expires_at, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, TRUE, NOW(), NOW())
       RETURNING *`,
      [user.id, user.username, name, keyHash, validPermissions, finalRateLimit, expiresAt]
    );

    const keyDoc = keyResult.rows[0];

    return NextResponse.json({
      success: true,
      key: {
        _id: String(keyDoc.id),
        id: keyDoc.id,
        name: keyDoc.name,
        apiKey, // Only returned once at creation!
        permissions: keyDoc.permissions,
        rateLimit: keyDoc.rate_limit,
        expiresAt: keyDoc.expires_at,
        createdAt: keyDoc.created_at,
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

    if (!keyId || isNaN(parseInt(keyId, 10))) {
      return NextResponse.json(
        { success: false, error: 'Invalid key ID' },
        { status: 400 }
      );
    }

    const parsedKeyId = parseInt(keyId, 10);

    // Check ownership & rank
    const keyResult = await query(`SELECT * FROM api_keys WHERE id = $1`, [parsedKeyId]);

    if (keyResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      );
    }

    const key = keyResult.rows[0];

    const localUserResult = await query(
      `SELECT rank FROM users WHERE id = $1`,
      [user.id]
    );
    const userRank = localUserResult.rows[0]?.rank || 'user';

    if (key.user_id !== user.id && !['admin', 'owner'].includes(userRank)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to delete this key' },
        { status: 403 }
      );
    }

    await query(`DELETE FROM api_keys WHERE id = $1`, [parsedKeyId]);

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
