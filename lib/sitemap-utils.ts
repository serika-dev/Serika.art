import { getCollection } from "./db";

export const SITEMAP_SIZE = 45000;
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
  const imagesCollection = await getCollection("images");
  const images = await imagesCollection
    .find(
      { deleted: { $ne: true }, unlisted: { $ne: true } },
      { projection: { sequentialId: 1, updatedAt: 1, createdAt: 1, url: 1 } }
    )
    .sort({ sequentialId: -1 })
    .skip(chunkId * SITEMAP_SIZE)
    .limit(SITEMAP_SIZE)
    .toArray();

  return images
    .filter((img: any) => img.sequentialId)
    .map((image: any) => ({
      url: `${BASE_URL}/image/${image.sequentialId}`,
      lastModified: image.updatedAt || image.createdAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
      images: [image.url],
    }));
}

export async function getArtistRoutes(chunkId: number) {
  const tagsCollection = await getCollection("tags");
  const artists = await tagsCollection
    .find({ type: "artist" }, { projection: { name: 1, count: 1, updatedAt: 1 } })
    .sort({ count: -1 })
    .skip(chunkId * SITEMAP_SIZE)
    .limit(SITEMAP_SIZE)
    .toArray();

  return artists.map(artist => ({
    url: `${BASE_URL}/artist/${encodeURIComponent(artist.name.replace(/ /g, "_"))}`,
    lastModified: artist.updatedAt || new Date(),
    changeFrequency: artist.count > 100 ? "daily" : "weekly",
    priority: Math.min(0.8, 0.5 + (artist.count / 1000)),
  }));
}
