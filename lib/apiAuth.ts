import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export interface ApiKey {
  _id: ObjectId;
  userId: ObjectId;
  username: string;
  name: string;
  key: string;
  keyHash: string;
  permissions: ApiPermission[];
  rateLimit: number; // requests per minute
  usageCount: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiPermission = 
  | 'images:read'
  | 'images:write'
  | 'images:delete'
  | 'tags:read'
  | 'tags:write'
  | 'users:read'
  | 'random:read'
  | 'upload';

export const ALL_PERMISSIONS: ApiPermission[] = [
  'images:read',
  'images:write',
  'images:delete',
  'tags:read',
  'tags:write',
  'users:read',
  'random:read',
  'upload',
];

export const DEFAULT_PERMISSIONS: ApiPermission[] = [
  'images:read',
  'tags:read',
  'users:read',
  'random:read',
];

// Generate a secure API key
export function generateApiKey(): string {
  const prefix = 'sk_serika_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomPart}`;
}

// Hash API key for storage
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Rate limiting storage (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Validate API key and check permissions
export async function validateApiKey(
  request: NextRequest,
  requiredPermissions: ApiPermission[] = []
): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string; statusCode?: number }> {
  // Get API key from header
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-Key');
  
  let keyValue: string | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    keyValue = authHeader.substring(7);
  } else if (apiKeyHeader) {
    keyValue = apiKeyHeader;
  }
  
  if (!keyValue) {
    return {
      valid: false,
      error: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header',
      statusCode: 401,
    };
  }
  
  // Validate key format
  if (!keyValue.startsWith('sk_serika_')) {
    return {
      valid: false,
      error: 'Invalid API key format',
      statusCode: 401,
    };
  }
  
  const keyHash = hashApiKey(keyValue);
  const collection = await getCollection('api_keys');
  
  const apiKey = await collection.findOne({ keyHash, isActive: true }) as ApiKey | null;
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'Invalid or inactive API key',
      statusCode: 401,
    };
  }
  
  // Check expiration
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return {
      valid: false,
      error: 'API key has expired',
      statusCode: 401,
    };
  }
  
  // Check rate limit
  const now = Date.now();
  const rateLimitKey = keyHash;
  const rateLimit = rateLimitStore.get(rateLimitKey);
  
  if (rateLimit) {
    if (now < rateLimit.resetAt) {
      if (rateLimit.count >= apiKey.rateLimit) {
        const retryAfter = Math.ceil((rateLimit.resetAt - now) / 1000);
        return {
          valid: false,
          error: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
          statusCode: 429,
        };
      }
      rateLimit.count++;
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
    }
  } else {
    rateLimitStore.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
  }
  
  // Check permissions
  for (const permission of requiredPermissions) {
    if (!apiKey.permissions.includes(permission)) {
      return {
        valid: false,
        error: `Missing required permission: ${permission}`,
        statusCode: 403,
      };
    }
  }
  
  // Update usage stats
  await collection.updateOne(
    { _id: apiKey._id },
    {
      $inc: { usageCount: 1 },
      $set: { lastUsedAt: new Date() },
    }
  );
  
  return { valid: true, apiKey };
}

// Middleware helper for API routes
export async function withApiAuth(
  request: NextRequest,
  requiredPermissions: ApiPermission[],
  handler: (request: NextRequest, apiKey: ApiKey) => Promise<NextResponse>
): Promise<NextResponse> {
  const validation = await validateApiKey(request, requiredPermissions);
  
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: validation.error,
        code: validation.statusCode === 429 ? 'RATE_LIMITED' : 'UNAUTHORIZED',
      },
      { status: validation.statusCode }
    );
  }
  
  return handler(request, validation.apiKey!);
}

// Create API response with standard format
export function apiResponse<T>(data: T, meta?: Record<string, any>) {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

// Create API error response
export function apiError(error: string, statusCode: number = 400, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      code: code || 'ERROR',
    },
    { status: statusCode }
  );
}
