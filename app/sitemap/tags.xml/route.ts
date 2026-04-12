import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { BASE_URL, wrapInUrlset } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const tagsCollection = await getCollection("tags");
    const topTags = await tagsCollection
      .find({ count: { $gt: 50 }, type: { $ne: "artist" } }, { projection: { name: 1, updatedAt: 1 } })
      .sort({ count: -1 })
      .limit(1000)
      .toArray();

    const routes = topTags.map(tag => ({
      url: `${BASE_URL}/posts?tags=${encodeURIComponent(tag.name)}`,
      lastModified: tag.updatedAt || new Date(),
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
