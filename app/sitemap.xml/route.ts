import { NextResponse } from "next/server";
import { getCachedCount } from "@/lib/db";
import { BASE_URL, SITEMAP_SIZE, wrapInSitemapIndex } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const [totalImages, totalArtists] = await Promise.all([
      getCachedCount("images", "deleted = FALSE AND unlisted = FALSE"),
      getCachedCount("tags", "type = $1", ["artist"])
    ]);

    const imageChunks = Math.ceil(totalImages / SITEMAP_SIZE);
    const artistChunks = Math.ceil(totalArtists / SITEMAP_SIZE);
    
    const urls = [
      `${BASE_URL}/sitemap/misc.xml`,
      `${BASE_URL}/sitemap/tags.xml`,
    ];

    for (let i = 0; i < artistChunks; i++) {
        urls.push(`${BASE_URL}/sitemap/artists/${i}.xml`);
    }

    for (let i = 0; i < imageChunks; i++) {
        urls.push(`${BASE_URL}/sitemap/images/${i}.xml`);
    }

    const xml = wrapInSitemapIndex(urls);

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
