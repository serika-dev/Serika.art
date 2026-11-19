/**
 * Finds posts whose image can't load and removes them (soft delete, the same
 * as a moderator removal, so they can be restored).
 *
 * Checks:
 *  - url/thumbnail_url that aren't on the CDN (the old local-storage fallback
 *    wrote /uploads/... paths that production never serves)
 *  - with --recent-days N: downloads every post from the last N days and
 *    decodes it fully (catches truncated/corrupt files on the CDN)
 *  - with --user-uploads: the same full check for every post uploaded through
 *    the site or API (everything not imported from danbooru)
 *  - with --ids 1,2,3: the same full check for specific post ids
 *
 * Dry run by default; pass --apply to remove what it finds.
 *
 *   npx tsx scripts/remove-broken-images.ts [--user-uploads] [--recent-days 90] [--ids 1,2] [--apply]
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { checkImage } from '../lib/imageValidation';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const APPLY = args.includes('--apply');
const RECENT_DAYS = Number(flag('--recent-days') || 0);
const USER_UPLOADS = args.includes('--user-uploads');
const IDS = (flag('--ids') || '').split(',').map(Number).filter(Boolean);
const CDN = `https://${process.env.B2_CUSTOM_DOMAIN || 'cdn.serika.art'}/`;

interface Row { id: number; sequential_id: number; url: string; thumbnail_url: string | null }
interface Broken { row: Row; reason: string }

async function fileProblem(url: string | null, label: string): Promise<string | null> {
  if (!url) return null; // no thumbnail: the site falls back to the full image
  if (!url.startsWith(CDN)) return `${label} not on CDN (${url})`;
  const res = await fetch(url);
  if (!res.ok) return `${label} HTTP ${res.status}`;
  try {
    await checkImage(Buffer.from(await res.arrayBuffer()));
    return null;
  } catch (err) {
    return `${label}: ${(err as Error).message}`;
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const broken: Broken[] = [];

  // Cheap check over every post: paths that aren't on the CDN
  const offCdn = await pool.query<Row>(
    `SELECT id, sequential_id, url, thumbnail_url FROM images
     WHERE NOT deleted AND (url NOT LIKE $1 || '%' OR (thumbnail_url <> '' AND thumbnail_url NOT LIKE $1 || '%'))`,
    [CDN]
  );
  for (const row of offCdn.rows) broken.push({ row, reason: `not on CDN: ${row.url}` });

  // Full download + decode for recent posts / chosen ids
  const deep: Row[] = [];
  if (RECENT_DAYS > 0) {
    const r = await pool.query<Row>(
      `SELECT id, sequential_id, url, thumbnail_url FROM images
       WHERE NOT deleted AND url LIKE $1 || '%' AND created_at > now() - make_interval(days => $2)`,
      [CDN, RECENT_DAYS]
    );
    deep.push(...r.rows);
  }
  if (USER_UPLOADS) {
    const r = await pool.query<Row>(
      `SELECT id, sequential_id, url, thumbnail_url FROM images
       WHERE NOT deleted AND url LIKE $1 || '%' AND url NOT LIKE '%danbooru-%'`,
      [CDN]
    );
    deep.push(...r.rows);
  }
  if (IDS.length) {
    const r = await pool.query<Row>(
      `SELECT id, sequential_id, url, thumbnail_url FROM images WHERE NOT deleted AND sequential_id = ANY($1::int[])`,
      [IDS]
    );
    deep.push(...r.rows);
  }
  const seen = new Set(broken.map((b) => b.row.id));
  const queue = deep.filter((r) => !seen.has(r.id) && seen.add(r.id));
  console.log(`Off-CDN: ${broken.length}. Fully checking ${queue.length} more...`);
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < queue.length) {
        const row = queue[next++];
        const problems = (
          await Promise.all([
            fileProblem(row.url, 'image').catch((e) => `image fetch failed: ${e.message}`),
            fileProblem(row.thumbnail_url, 'thumbnail').catch((e) => `thumbnail fetch failed: ${e.message}`),
          ])
        ).filter(Boolean);
        if (problems.length) broken.push({ row, reason: problems.join('; ') });
      }
    })
  );

  for (const b of broken) console.log(`#${b.row.sequential_id}\t${b.reason}`);
  console.log(`\n${broken.length} broken post(s).`);

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to remove them.');
  } else if (broken.length) {
    const res = await pool.query(
      `UPDATE images SET deleted = TRUE, deleted_at = NOW(), deleted_by_username = 'system',
         deletion_reason = 'Broken image: the file is missing or corrupt', updated_at = NOW()
       WHERE id = ANY($1::int[]) AND NOT deleted`,
      [broken.map((b) => b.row.id)]
    );
    console.log(`Removed ${res.rowCount} post(s).`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
