import { NextRequest, NextResponse } from 'next/server';
import { query, cacheGet, cacheSet } from '@/lib/db';
import crypto from 'crypto';

export interface ApiKey {
  id: number;
  user_id: string;
  username: string;
  name: string;
  key_hash: string;
  permissions: ApiPermission[];
  rate_limit: number;
  usage_count: number;
  last_used_at?: Date;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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

// Rate limiting via Redis/memory cache
async function checkRateLimit(keyHash: string, limit: number): Promise<{ allowed: boolean; retryAfter?: number }> {
  const cacheKey = `ratelimit:${keyHash}`;
  const now = Date.now();
  const cached = await cacheGet(cacheKey);
  
  if (cached) {
    const data = JSON.parse(cached);
    if (now < data.resetAt) {
      if (data.count >= limit) {
        return { allowed: false, retryAfter: Math.ceil((data.resetAt - now) / 1000) };
      }
      data.count++;
      await cacheSet(cacheKey, JSON.stringify(data), 60);
      return { allowed: true };
    }
  }
  
  // New window
  await cacheSet(cacheKey, JSON.stringify({ count: 1, resetAt: now + 60000 }), 60);
  return { allowed: true };
}

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
  
  const result = await query(
    `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = TRUE`,
    [keyHash]
  );
  
  if (result.rows.length === 0) {
    return {
      valid: false,
      error: 'Invalid or inactive API key',
      statusCode: 401,
    };
  }
  
  const apiKey = result.rows[0] as ApiKey;
  
  // Check expiration
  if (apiKey.expires_at && new Date() > new Date(apiKey.expires_at)) {
    return {
      valid: false,
      error: 'API key has expired',
      statusCode: 401,
    };
  }
  
  // Check rate limit
  const rl = await checkRateLimit(keyHash, apiKey.rate_limit);
  if (!rl.allowed) {
    return {
      valid: false,
      error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds`,
      statusCode: 429,
    };
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
  
  // Update usage stats (fire-and-forget)
  query(
    `UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1`,
    [apiKey.id]
  ).catch(() => {});
  
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
