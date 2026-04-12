import { NextResponse } from "next/server";
import { getArtistRoutes, wrapInUrlset } from "@/lib/sitemap-utils";

export async function GET() {
  try {
    const routes = await getArtistRoutes(0); // Serve first chunk for now
    const xml = wrapInUrlset(routes);

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generating artist sitemap:", error);
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
