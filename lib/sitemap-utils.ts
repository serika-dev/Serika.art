import { query } from "./db";

export const SITEMAP_SIZE = 5000;
export const BASE_URL = "https://serika.art";

export function wrapInSitemapIndex(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`).join("\n")}
</sitemapindex>`;
}

export function wrapInUrlset(routes: any[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${routes.map(r => `  <url>
    <loc>${r.url}</loc>
    ${r.lastModified ? `<lastmod>${new Date(r.lastModified).toISOString()}</lastmod>` : ''}
    ${r.changeFrequency ? `<changefreq>${r.changeFrequency}</changefreq>` : ''}
    ${r.priority ? `<priority>${r.priority}</priority>` : ''}
    ${r.images && r.images.length > 0 ? r.images.map((img: string) => `    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>`).join("\n") : ''}
  </url>`).join("\n")}
</urlset>`;
}

export async function getImageRoutes(chunkId: number) {
  const offset = chunkId * SITEMAP_SIZE;
  const result = await query(
    `SELECT sequential_id, updated_at, created_at, url FROM images
     WHERE deleted = FALSE AND unlisted = FALSE
     ORDER BY sequential_id DESC
     LIMIT $1 OFFSET $2`,
    [SITEMAP_SIZE, offset]
  );

  return result.rows
    .filter((img: any) => img.sequential_id)
    .map((image: any) => ({
      url: `${BASE_URL}/image/${image.sequential_id}`,
      lastModified: image.updated_at || image.created_at || new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
      images: [image.url],
    }));
}

export async function getArtistRoutes(chunkId: number) {
  const offset = chunkId * SITEMAP_SIZE;
  const result = await query(
    `SELECT name, count, created_at FROM tags
     WHERE type = 'artist'
     ORDER BY count DESC
     LIMIT $1 OFFSET $2`,
    [SITEMAP_SIZE, offset]
  );

  return result.rows.map(artist => ({
    url: `${BASE_URL}/artist/${encodeURIComponent(artist.name.replace(/ /g, "_"))}`,
    lastModified: artist.created_at || new Date(),
    changeFrequency: artist.count > 100 ? "daily" : "weekly",
    priority: Math.min(0.8, 0.5 + (artist.count / 1000)),
  }));
}
