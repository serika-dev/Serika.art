import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { swrCached } from '@/lib/swrCache';
import { publicImageFilter } from '@/lib/contentFilters';
import { getBackfillStatus } from '@/lib/autotagWorker';
import { isAutotaggerConfigured } from '@/lib/autotagger';
import { getTagMigrationStatus } from '@/lib/tagUnderscoreMigration';
import { NO_STORE_HEADERS } from '@/lib/cacheHeaders';

// GET /api/admin/overview – numbers for the admin dashboard and sidebar badges.
// Whole-table counts are cached (refreshed every 5 minutes in the background);
// queue sizes are live because they are small and admins act on them.
export async function GET() {
  const user = await getCurrentUser();
  const rank = user ? (await query(`SELECT rank FROM users WHERE id = $1`, [user.id])).rows[0]?.rank : null;
  if (rank !== 'admin' && rank !== 'owner') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  try {
    const [totals, pending, imports, recentModeration, backfill, tagMigration] = await Promise.all([
      swrCached('admin:overview:totals:v1', { freshSeconds: 300, maxAgeSeconds: 86400 }, async () => {
        const [images, tags, users, day, week] = await Promise.all([
          query(`SELECT GREATEST(reltuples, 0)::bigint AS n FROM pg_class WHERE oid = 'images'::regclass`),
          query(`SELECT COUNT(*) AS n FROM tags`),
          query(`SELECT COUNT(*) AS n FROM users`),
          query(`SELECT COUNT(*) AS n FROM images WHERE ${publicImageFilter()} AND created_at >= NOW() - INTERVAL '24 hours'`),
          query(`SELECT COUNT(*) AS n FROM images WHERE ${publicImageFilter()} AND created_at >= NOW() - INTERVAL '7 days'`),
        ]);
        const n = (r: { rows: { n: string }[] }) => parseInt(r.rows[0]?.n ?? '0', 10);
        return { images: n(images), tags: n(tags), users: n(users), uploadsDay: n(day), uploadsWeek: n(week) };
      }),
      query(`SELECT
               (SELECT COUNT(*) FROM dmca_requests WHERE status = 'pending') AS dmca,
               (SELECT COUNT(*) FROM artist_claims WHERE status = 'pending') AS claims`),
      query(`SELECT status, COUNT(*) AS n FROM import_jobs WHERE status IN ('pending', 'running', 'paused') GROUP BY status`),
      query(`SELECT id, action, target_id, performed_by_username, reason, created_at
             FROM moderation_logs ORDER BY created_at DESC LIMIT 6`),
      isAutotaggerConfigured() ? getBackfillStatus().catch(() => null) : Promise.resolve(null),
      getTagMigrationStatus().catch(() => null),
    ]);

    const importCounts = Object.fromEntries(imports.rows.map((r) => [r.status, parseInt(r.n, 10)]));
    return NextResponse.json(
      {
        success: true,
        totals,
        pending: {
          dmca: parseInt(pending.rows[0].dmca, 10),
          claims: parseInt(pending.rows[0].claims, 10),
          imports: (importCounts.pending ?? 0) + (importCounts.running ?? 0) + (importCounts.paused ?? 0),
          importRunning: (importCounts.running ?? 0) > 0,
        },
        recentModeration: recentModeration.rows,
        autotag: backfill,
        tagMigration,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Admin overview error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load overview' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
