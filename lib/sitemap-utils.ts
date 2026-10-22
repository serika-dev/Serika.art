import { query } from "./db";
import { swrCached } from "./swrCache";

export const SITEMAP_SIZE = 5000;
export const BASE_URL = "https://serika.art";

// lastmod only where it is real: a child sitemap that always claims "changed
// just now" teaches Google to ignore lastmod and recrawl everything blindly.
export function wrapInSitemapIndex(entries: { url: string; lastmod?: string | Date | null }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(({ url, lastmod }) => `  <sitemap>
    <loc>${url}</loc>${lastmod ? `
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}
  </sitemap>`).join("\n")}
</sitemapindex>`;
}

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function wrapInUrlset(routes: any[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${routes.map(r => `  <url>
    <loc>${xmlEscape(r.url)}</loc>
    ${r.lastModified ? `<lastmod>${new Date(r.lastModified).toISOString()}</lastmod>` : ''}
    ${r.changeFrequency ? `<changefreq>${r.changeFrequency}</changefreq>` : ''}
    ${r.priority ? `<priority>${r.priority}</priority>` : ''}
    ${r.images && r.images.length > 0 ? r.images.map((img: string) => `    <image:image>
      <image:loc>${xmlEscape(img)}</image:loc>
    </image:image>`).join("\n") : ''}
  </url>`).join("\n")}
</urlset>`;
}

// Image sitemaps are fixed sequential_id ranges (chunk 3 = ids 15001–20000),
// not OFFSET pages of "newest first": those shifted every URL into another
// file on each upload and made deep chunks scan millions of rows.
export function imageChunkRange(chunkId: number): [number, number] {
  return [chunkId * SITEMAP_SIZE + 1, (chunkId + 1) * SITEMAP_SIZE];
}

/** Non-empty image chunks with the newest change in each, for the sitemap index. */
export function getImageChunks(): Promise<{ chunk: number; lastmod: string }[]> {
  return swrCached("sitemap:image-chunks:v1", { freshSeconds: 6 * 3600, maxAgeSeconds: 3 * 86400 }, async () => {
    const result = await query(
      `SELECT ((sequential_id - 1) / ${SITEMAP_SIZE})::int AS chunk,
              MAX(COALESCE(updated_at, created_at)) AS lastmod
       FROM images
       WHERE deleted = FALSE AND unlisted = FALSE AND sequential_id IS NOT NULL
       GROUP BY 1 ORDER BY 1`
    );
    return result.rows.map((r: any) => ({ chunk: r.chunk, lastmod: new Date(r.lastmod).toISOString() }));
  });
}

export async function getImageRoutes(chunkId: number) {
  const [from, to] = imageChunkRange(chunkId);
  const result = await query(
    `SELECT sequential_id, updated_at, created_at, url FROM images
     WHERE sequential_id BETWEEN $1 AND $2 AND deleted = FALSE AND unlisted = FALSE
     ORDER BY sequential_id`,
    [from, to]
  );

  return result.rows.map((image: any) => ({
    url: `${BASE_URL}/image/${image.sequential_id}`,
    lastModified: image.updated_at || image.created_at,
    images: [image.url],
  }));
}

// Artist pages with only a couple of posts are thin near-copies of those
// posts; they stay reachable through links but aren't submitted.
export const ARTIST_SITEMAP_MIN_POSTS = 3;

export async function getArtistRoutes(chunkId: number) {
  const offset = chunkId * SITEMAP_SIZE;
  const result = await query(
    `SELECT name, count, created_at FROM tags
     WHERE type = 'artist' AND count >= $3
     ORDER BY count DESC, name
     LIMIT $1 OFFSET $2`,
    [SITEMAP_SIZE, offset, ARTIST_SITEMAP_MIN_POSTS]
  );

  return result.rows.map(artist => ({
    url: `${BASE_URL}/artist/${encodeURIComponent(artist.name.replace(/ /g, "_"))}`,
    lastModified: artist.created_at,
  }));
}
