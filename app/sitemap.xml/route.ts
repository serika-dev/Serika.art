import { NextResponse } from "next/server";
import { getCachedCount } from "@/lib/db";
import { ARTIST_SITEMAP_MIN_POSTS, BASE_URL, SITEMAP_SIZE, getImageChunks, wrapInSitemapIndex } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const [imageChunks, totalArtists] = await Promise.all([
      getImageChunks(),
      getCachedCount("tags", "type = $1 AND count >= $2", ["artist", ARTIST_SITEMAP_MIN_POSTS]),
    ]);
    const artistChunks = Math.ceil(totalArtists / SITEMAP_SIZE);

    const entries: { url: string; lastmod?: string }[] = [
      { url: `${BASE_URL}/sitemap/misc.xml` },
      { url: `${BASE_URL}/sitemap/tags.xml` },
    ];
    for (let i = 0; i < artistChunks; i++) {
      entries.push({ url: `${BASE_URL}/sitemap/artists/${i}.xml` });
    }
    for (const { chunk, lastmod } of imageChunks) {
      entries.push({ url: `${BASE_URL}/sitemap/images/${chunk}.xml`, lastmod });
    }

    const xml = wrapInSitemapIndex(entries);

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generating sitemap index:", error);
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
