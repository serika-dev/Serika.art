import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BASE_URL, wrapInUrlset } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const tagsResult = await query(
      // Every tag page with real content (artists have their own sitemaps);
      // 50,000 is the per-file sitemap limit
      `SELECT name, count FROM tags WHERE count >= 20 AND type != 'artist' ORDER BY count DESC LIMIT 50000`
    );

    const routes = tagsResult.rows.map((tag) => ({
      url: `${BASE_URL}/posts?tags=${encodeURIComponent(tag.name)}`,
      changeFrequency: "daily",
      // Bigger tags first: Google treats priority as a relative hint
      priority: tag.count >= 10000 ? 0.8 : tag.count >= 1000 ? 0.7 : 0.6,
    }));

    const xml = wrapInUrlset(routes);

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generating tags sitemap:", error);
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
