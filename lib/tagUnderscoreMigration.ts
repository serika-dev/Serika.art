import { getImportPool, importQuery, withImportTransaction, cacheDel } from '@/lib/db';
import { normalizeTagName } from '@/lib/tagName';
import { clearImportTagCache } from '@/lib/importQueue';

// One-time migration to underscore tag names ("simple background" →
// "simple_background"). Tags with a space are renamed; when the underscore
// spelling already exists the two are merged: the smaller tag's post links are
// moved to the larger one in chunks, artist pages/wikis/reviews/claims and
// comments follow, and the survivor ends up with the underscore name.
//
// Enabled with TAG_UNDERSCORE_MIGRATION=true. Resumable (cursor in counters),
// one runner across processes (advisory lock), on the bounded import pool.

const LOCK_KEY = 72419641801;
const C = {
  cursor: 'tagUnderscoreCursor',
  done: 'tagUnderscoreDone',
  renamed: 'tagUnderscoreRenamed',
  merged: 'tagUnderscoreMerged',
  linksMoved: 'tagUnderscoreLinksMoved',
};
const BATCH = 200;
const CHUNK = 10000;
const PAUSE_MS = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TagRow { id: number; name: string; type: string; count: number }

let started = false;

export function startTagUnderscoreMigration(): void {
  if (started) return;
  started = true;
  run().catch((err) => console.error('[tag-migration] Stopped:', err));
}

async function counter(name: string): Promise<number> {
  const r = await importQuery(`SELECT value FROM counters WHERE name = $1`, [name]);
  return Number(r.rows[0]?.value ?? 0);
}
async function setCounter(name: string, value: number) {
  await importQuery(
    `INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [name, value]
  );
}
async function bump(name: string, by = 1) {
  await importQuery(
    `INSERT INTO counters (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = counters.value + EXCLUDED.value`,
    [name, by]
  );
}

export async function getTagMigrationStatus() {
  const r = await importQuery<{ name: string; value: number }>(`SELECT name, value FROM counters WHERE name = ANY($1::text[])`, [Object.values(C)]);
  const v = Object.fromEntries(r.rows.map((x) => [x.name, Number(x.value)]));
  return {
    enabled: process.env.TAG_UNDERSCORE_MIGRATION === 'true',
    done: (v[C.done] ?? 0) === 1,
    renamed: v[C.renamed] ?? 0,
    merged: v[C.merged] ?? 0,
    linksMoved: v[C.linksMoved] ?? 0,
  };
}

async function run() {
  const client = await getImportPool().connect();
  try {
    if (!(await client.query(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS ok`)).rows[0].ok) return;
    try {
      if ((await counter(C.done)) === 1) return;
      console.log('[tag-migration] Started');
      for (;;) {
        const cursor = await counter(C.cursor);
        const batch = await importQuery<TagRow>(
          `SELECT id, name, type, count FROM tags WHERE id > $1 AND name ~ '\\s' ORDER BY id LIMIT $2`,
          [cursor, BATCH]
        );
        if (batch.rows.length === 0) break;
        for (const tag of batch.rows) {
          try {
            await migrateTag(tag);
          } catch (err) {
            console.error(`[tag-migration] Tag ${tag.id} "${tag.name}" failed, skipping:`, err);
          }
          await setCounter(C.cursor, tag.id);
        }
        clearImportTagCache();
      }
      await setCounter(C.done, 1);
      clearImportTagCache();
      console.log('[tag-migration] Finished');
    } finally {
      await client.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {});
    }
  } finally {
    client.release();
  }
}

async function forgetCached(...names: string[]) {
  const keys = new Set<string>();
  for (const n of names) {
    const lower = n.toLowerCase();
    keys.add(`tagref:${lower}`);
    keys.add(`tagref:${lower.replace(/_/g, ' ')}`);
    keys.add(`tagref:${normalizeTagName(lower)}`);
  }
  await Promise.all([...keys].map((k) => cacheDel(k).catch(() => {})));
}

async function updateTagNameColumns(client: { query: (q: string, p: any[]) => Promise<any> }, tagId: number, name: string) {
  await client.query(`UPDATE artists SET tag_name = $2 WHERE tag_id = $1`, [tagId, name]);
  await client.query(`UPDATE artist_claims SET artist_tag_name = $2 WHERE artist_tag_id = $1`, [tagId, name]);
  await client.query(`UPDATE artist_reviews SET artist_tag_name = $2 WHERE artist_tag_id = $1`, [tagId, name]);
  await client.query(`UPDATE artist_wikis SET artist_tag_name = $2 WHERE artist_tag_id = $1`, [tagId, name]);
}

async function migrateTag(src: TagRow) {
  const target = normalizeTagName(src.name);
  if (!target || target === src.name) return;

  const existing = await importQuery<TagRow>(`SELECT id, name, type, count FROM tags WHERE name = $1`, [target]);
  if (existing.rows.length === 0) {
    try {
      await withImportTransaction(async (client) => {
        await client.query(`UPDATE tags SET name = $2 WHERE id = $1`, [src.id, target]);
        await updateTagNameColumns(client, src.id, target);
      });
      await bump(C.renamed);
      await forgetCached(src.name, target);
      return;
    } catch (err: any) {
      if (err?.code !== '23505') throw err; // someone created the underscore tag meanwhile → merge
    }
  }

  const dst = (await importQuery<TagRow>(`SELECT id, name, type, count FROM tags WHERE name = $1`, [target])).rows[0];
  if (!dst) return;
  await mergeTags(src, dst, target);
}

async function moveLinks(dropId: number, keepId: number, limit: number | null) {
  const res = await importQuery(
    `WITH batch AS (SELECT image_id FROM image_tags WHERE tag_id = $1 ${limit ? `LIMIT ${limit}` : ''}),
          ins AS (INSERT INTO image_tags (image_id, tag_id) SELECT image_id, $2 FROM batch ON CONFLICT DO NOTHING)
     DELETE FROM image_tags WHERE tag_id = $1 AND image_id IN (SELECT image_id FROM batch)`,
    [dropId, keepId]
  );
  return res.rowCount ?? 0;
}

async function mergeTags(src: TagRow, dst: TagRow, target: string) {
  // Move the smaller tag into the larger one – far fewer rows to rewrite
  const [keep, drop] = src.count > dst.count ? [src, dst] : [dst, src];

  for (;;) {
    const moved = await moveLinks(drop.id, keep.id, CHUNK);
    if (moved === 0) break;
    await bump(C.linksMoved, moved);
    await sleep(PAUSE_MS);
  }

  await withImportTransaction(async (client) => {
    // Links added while we were moving
    await client.query(
      `WITH batch AS (SELECT image_id FROM image_tags WHERE tag_id = $1),
            ins AS (INSERT INTO image_tags (image_id, tag_id) SELECT image_id, $2 FROM batch ON CONFLICT DO NOTHING)
       DELETE FROM image_tags WHERE tag_id = $1`,
      [drop.id, keep.id]
    );

    // Artist page: merge fields into the kept tag's page
    const artists = await client.query(`SELECT * FROM artists WHERE tag_id = ANY($1::int[])`, [[keep.id, drop.id]]);
    const keepArtist = artists.rows.find((a: any) => a.tag_id === keep.id);
    const dropArtist = artists.rows.find((a: any) => a.tag_id === drop.id);
    if (dropArtist && !keepArtist) {
      await client.query(`UPDATE artists SET tag_id = $2 WHERE id = $1`, [dropArtist.id, keep.id]);
    } else if (dropArtist && keepArtist) {
      await client.query(
        `UPDATE artists SET
           claimed_by_user_id = COALESCE(claimed_by_user_id, $2),
           claimed_by_username = COALESCE(claimed_by_username, $3),
           verified = verified OR $4,
           avatar_url = COALESCE(NULLIF(avatar_url, ''), $5),
           banner_url = COALESCE(NULLIF(banner_url, ''), $6),
           bio = COALESCE(NULLIF(bio, ''), $7),
           socials = COALESCE($8::jsonb, '{}'::jsonb) || COALESCE(socials, '{}'::jsonb),
           updated_at = NOW()
         WHERE id = $1`,
        [keepArtist.id, dropArtist.claimed_by_user_id, dropArtist.claimed_by_username, dropArtist.verified,
         dropArtist.avatar_url, dropArtist.banner_url, dropArtist.bio, JSON.stringify(dropArtist.socials || {})]
      );
      await client.query(`DELETE FROM artists WHERE id = $1`, [dropArtist.id]);
    }

    // Wiki: keep the longer one
    const wikis = await client.query(`SELECT id, artist_tag_id, length(content) AS len FROM artist_wikis WHERE artist_tag_id = ANY($1::int[])`, [[keep.id, drop.id]]);
    const keepWiki = wikis.rows.find((w: any) => w.artist_tag_id === keep.id);
    const dropWiki = wikis.rows.find((w: any) => w.artist_tag_id === drop.id);
    if (dropWiki) {
      if (keepWiki && Number(keepWiki.len) >= Number(dropWiki.len)) {
        await client.query(`DELETE FROM artist_wikis WHERE id = $1`, [dropWiki.id]);
      } else {
        if (keepWiki) await client.query(`DELETE FROM artist_wikis WHERE id = $1`, [keepWiki.id]);
        await client.query(`UPDATE artist_wikis SET artist_tag_id = $2 WHERE id = $1`, [dropWiki.id, keep.id]);
      }
    }

    // Reviews: one per user per artist
    await client.query(
      `UPDATE artist_reviews SET artist_tag_id = $2
       WHERE artist_tag_id = $1 AND user_id NOT IN (SELECT user_id FROM artist_reviews WHERE artist_tag_id = $2)`,
      [drop.id, keep.id]
    );
    await client.query(`DELETE FROM artist_reviews WHERE artist_tag_id = $1`, [drop.id]);
    await client.query(`UPDATE artist_claims SET artist_tag_id = $2 WHERE artist_tag_id = $1`, [drop.id, keep.id]);
    await client.query(`UPDATE comments SET artist_tag_id = $2 WHERE artist_tag_id = $1`, [drop.id, keep.id]);

    await client.query(`DELETE FROM tags WHERE id = $1`, [drop.id]);
    // A specific type (artist, character…) beats "general"
    const type = keep.type === 'general' && drop.type !== 'general' ? drop.type : keep.type;
    await client.query(
      `UPDATE tags SET name = $2, type = $3, count = (SELECT COUNT(*) FROM image_tags WHERE tag_id = $1) WHERE id = $1`,
      [keep.id, target, type]
    );
    await updateTagNameColumns(client, keep.id, target);
  });

  await bump(C.merged);
  await forgetCached(src.name, dst.name, target);
}
