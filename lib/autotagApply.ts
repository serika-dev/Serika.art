import { importQuery, withImportTransaction } from '@/lib/db';
import { normalizeTagName } from '@/lib/tagName';
import { autotagImage, type SuggestedTag } from '@/lib/autotagger';
import { revalidateImagePage } from '@/lib/revalidate';

// Applies autotagger predictions to stored posts: used for every new upload
// and by the backfill worker (lib/autotagWorker.ts). Only adds tags – a tag
// someone put on a post is never removed – and only "recommended" ones (the
// confidence thresholds in lib/autotagger.ts). Runs on the bounded import
// pool so it can never starve live requests.

/** Tags a post must have to be accepted (see /guidelines/tagging). */
export const MIN_TAGS = 5;

const MAX_ADDED_TAGS = 40;

/** "long hair" and "long_hair" are the same tag for de-duplication purposes. */
export const sameTagKey = normalizeTagName;

/** Add the recommended suggestions a post doesn't have yet. Returns the added tag names. */
export async function applySuggestedTags(imageId: number, suggestions: SuggestedTag[]): Promise<string[]> {
  return withImportTransaction(async (client) => {
    const existing = await client.query<{ name: string }>(
      `SELECT t.name FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = $1`,
      [imageId]
    );
    const have = new Set(existing.rows.map((r) => sameTagKey(r.name)));

    const wanted = suggestions
      .filter((s) => s.recommended && !have.has(sameTagKey(s.name)))
      .slice(0, MAX_ADDED_TAGS);

    if (wanted.length > 0) {
      // Suggestions already use the existing Serika spelling when there is one;
      // brand-new tags get created with the tagger's (Danbooru) name and type.
      await client.query(
        `INSERT INTO tags (name, type, count, created_at)
         SELECT name, type, 0, NOW() FROM UNNEST($1::text[], $2::text[]) AS t(name, type)
         ON CONFLICT (name) DO NOTHING`,
        [wanted.map((s) => s.name), wanted.map((s) => s.type)]
      );
    }

    const added = wanted.length
      ? await client.query<{ tag_id: number }>(
          `INSERT INTO image_tags (image_id, tag_id)
           SELECT $1, id FROM tags WHERE name = ANY($2::text[])
           ON CONFLICT DO NOTHING
           RETURNING tag_id`,
          [imageId, wanted.map((s) => s.name)]
        )
      : { rows: [] as { tag_id: number }[] };

    const addedIds = added.rows.map((r) => r.tag_id);
    let addedNames: string[] = [];
    if (addedIds.length > 0) {
      const res = await client.query<{ name: string }>(
        `UPDATE tags SET count = count + 1 WHERE id = ANY($1::int[]) RETURNING name`,
        [addedIds]
      );
      addedNames = res.rows.map((r) => r.name);
    }

    await client.query(
      `UPDATE images
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('autotaggedAt', NOW(), 'autotagAdded', $2::jsonb),
           updated_at = NOW()
       WHERE id = $1`,
      [imageId, JSON.stringify(addedNames)]
    );
    return addedNames;
  });
}

/**
 * Run the tagger on a post and apply the result. Pass `buffer` when the file is
 * already in memory (uploads). `revalidate: false` for the backfill worker, which
 * runs outside a request (revalidatePath needs one); its pages pick up the new
 * tags at their next ISR refresh (≤5 min).
 */
export async function autotagPost(
  post: { id: number; sequentialId: number; url?: string },
  buffer?: Buffer,
  { revalidate = true }: { revalidate?: boolean } = {}
): Promise<string[]> {
  let data = buffer;
  if (!data) {
    if (!post.url) throw new Error('No image to tag');
    const res = await fetch(post.url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Image download failed: HTTP ${res.status}`);
    data = Buffer.from(await res.arrayBuffer());
  }

  const { tags } = await autotagImage(data);
  const added = await applySuggestedTags(post.id, tags);
  if (added.length > 0 && revalidate) revalidateImagePage(post.sequentialId);
  return added;
}

/** Mark a post as handled without tags (unreadable file etc.) so the backfill skips it. */
export async function markAutotagSkipped(imageId: number, reason: string) {
  await importQuery(
    `UPDATE images
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('autotaggedAt', NOW(), 'autotagSkipped', $2::text)
     WHERE id = $1`,
    [imageId, reason.slice(0, 200)]
  );
}
