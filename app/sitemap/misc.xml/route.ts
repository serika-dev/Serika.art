import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BASE_URL, wrapInUrlset } from "@/lib/sitemap-utils";
import { listDirectory } from "@/lib/userDirectory";

export async function GET() {
  try {
    const routes = [
      { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
      { url: `${BASE_URL}/posts`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
      { url: `${BASE_URL}/tags`, changeFrequency: "daily", priority: 0.9 },
      { url: `${BASE_URL}/artists`, changeFrequency: "daily", priority: 0.8 },
      { url: `${BASE_URL}/users`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${BASE_URL}/dmca`, changeFrequency: "monthly", priority: 0.3 },
      { url: `${BASE_URL}/api-docs`, changeFrequency: "weekly", priority: 0.6 },
    ];

    // Profiles of people who have uploaded (empty profiles are thin pages)
    try {
      const { users } = await listDirectory({ contributorsOnly: true, limit: 50000, sort: 'uploads' });
      for (const user of users) {
        routes.push({
          url: `${BASE_URL}/user/${encodeURIComponent(user.username.trim())}`,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    } catch {}
    routes.push({ url: `${BASE_URL}/guidelines/tagging`, changeFrequency: "monthly", priority: 0.4 });

    const xml = wrapInUrlset(routes);

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generating misc sitemap:", error);
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
