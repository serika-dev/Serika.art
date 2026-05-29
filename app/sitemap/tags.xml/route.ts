import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BASE_URL, wrapInUrlset } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const tagsResult = await query(
      `SELECT name, created_at FROM tags WHERE count > 50 AND type != 'artist' ORDER BY count DESC LIMIT 1000`
    );
    const topTags = tagsResult.rows;

    const routes = topTags.map(tag => ({
      url: `${BASE_URL}/posts?tags=${encodeURIComponent(tag.name)}`,
      lastModified: tag.created_at || new Date(),
      changeFrequency: "daily",
      priority: 0.7,
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
