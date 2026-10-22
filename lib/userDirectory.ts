import { query, cacheGet, cacheSet } from '@/lib/db';

// The user directory (/users, /api/v1/users). There are only a few thousand
// accounts, but counting each one's uploads by joining every image used to take
// 4–5 s per request. Instead: one cached list of accounts plus one cached
// upload count per account (an index probe each), then filter/sort/page in memory.

export interface DirectoryUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  rank: 'user' | 'moderator' | 'admin' | 'owner';
  createdAt: string;
  uploadCount: number;
}

export type DirectorySort = 'newest' | 'oldest' | 'alphabetical' | 'alphabetical-reverse' | 'uploads' | 'uploads-asc';

const CACHE_KEY = 'users:directory:v1';
const CACHE_TTL = 600;
const FRESH_FOR_MS = 120_000; // after this the list is refreshed in the background

// Accounts that aren't people: the "Anonymous" account that owns imported and
// anonymous uploads, and auto-generated placeholder accounts.
const SYSTEM_USERNAME = /^anonymous$/i;
const PLACEHOLDER_USERNAME = /^user_[a-zA-Z0-9]{6}$/;

let inflight: Promise<DirectoryUser[]> | null = null;

async function loadDirectory(): Promise<DirectoryUser[]> {
  const res = await query(
    `SELECT u.id, u.username, u.avatar_url, u.rank, u.created_at, c.n AS upload_count
     FROM users u
     CROSS JOIN LATERAL (
       SELECT COUNT(*) AS n FROM images i
       WHERE i.user_id = u.id AND i.deleted = FALSE AND i.unlisted = FALSE
     ) c
     WHERE LOWER(u.username) <> 'anonymous'`
  );
  const users: DirectoryUser[] = res.rows
    .filter((u) => !SYSTEM_USERNAME.test(u.username) && !PLACEHOLDER_USERNAME.test(u.username))
    .map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatar_url || null,
      rank: u.rank,
      createdAt: new Date(u.created_at).toISOString(),
      uploadCount: parseInt(u.upload_count, 10),
    }));
  await cacheSet(CACHE_KEY, JSON.stringify({ at: Date.now(), users }), CACHE_TTL);
  return users;
}

async function getDirectory(): Promise<DirectoryUser[]> {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) {
    try {
      const { at, users } = JSON.parse(cached) as { at: number; users: DirectoryUser[] };
      if (Date.now() - at > FRESH_FOR_MS && !inflight) {
        // Serve the cached list now, refresh it for the next request
        inflight = loadDirectory().catch(() => users).finally(() => { inflight = null; });
      }
      return users;
    } catch {
      // fall through
    }
  }
  if (!inflight) inflight = loadDirectory().finally(() => { inflight = null; });
  return inflight;
}

const compare: Record<DirectorySort, (a: DirectoryUser, b: DirectoryUser) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  alphabetical: (a, b) => a.username.localeCompare(b.username, 'en', { sensitivity: 'base' }),
  'alphabetical-reverse': (a, b) => b.username.localeCompare(a.username, 'en', { sensitivity: 'base' }),
  uploads: (a, b) => b.uploadCount - a.uploadCount || b.createdAt.localeCompare(a.createdAt),
  'uploads-asc': (a, b) => a.uploadCount - b.uploadCount || b.createdAt.localeCompare(a.createdAt),
};

/** Public upload count for a username (case-insensitive), or 0 for unknown/system accounts. */
export async function uploadCountFor(username: string): Promise<number> {
  const needle = username.trim().toLowerCase();
  const user = (await getDirectory()).find((u) => u.username.trim().toLowerCase() === needle);
  return user?.uploadCount ?? 0;
}

export function isDirectorySort(value: string | null | undefined): value is DirectorySort {
  return !!value && value in compare;
}

export async function listDirectory({
  page = 1,
  limit = 48,
  sort = 'uploads',
  q = '',
  contributorsOnly = true,
}: {
  page?: number;
  limit?: number;
  sort?: DirectorySort;
  q?: string;
  contributorsOnly?: boolean;
}) {
  const all = await getDirectory();
  const needle = q.trim().toLowerCase();
  const filtered = all.filter(
    (u) => (!contributorsOnly || u.uploadCount > 0) && (!needle || u.username.toLowerCase().includes(needle))
  );
  filtered.sort(compare[sort]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, page), pages);
  return {
    users: filtered.slice((current - 1) * limit, current * limit),
    pagination: { page: current, limit, total, pages },
    totals: {
      members: all.length,
      contributors: all.reduce((n, u) => n + (u.uploadCount > 0 ? 1 : 0), 0),
    },
  };
}
