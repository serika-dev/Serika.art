import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { BASE_URL, SITEMAP_SIZE, wrapInSitemapIndex } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const imagesCollection = await getCollection("images");
    const tagsCollection = await getCollection("tags");

    const [totalImages, totalArtists] = await Promise.all([
      imagesCollection.countDocuments({ deleted: { $ne: true }, unlisted: { $ne: true } }),
      tagsCollection.countDocuments({ type: "artist" })
    ]);

    const imageChunks = Math.ceil(totalImages / SITEMAP_SIZE);
    
    const urls = [
      `${BASE_URL}/sitemap/misc.xml`,
      `${BASE_URL}/sitemap/artists.xml`,
      `${BASE_URL}/sitemap/tags.xml`,
    ];

    for (let i = 0; i < imageChunks; i++) {
        // Match user's requested pattern /sitemap/images/n.xml
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
