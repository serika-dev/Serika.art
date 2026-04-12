import { NextRequest, NextResponse } from "next/server";
import { getArtistRoutes, wrapInUrlset } from "@/lib/sitemap-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chunkIdStr = id.replace(".xml", "");
    const chunkId = parseInt(chunkIdStr, 10);

    if (isNaN(chunkId)) {
      return new NextResponse("Invalid chunk ID", { status: 400 });
    }

    const routes = await getArtistRoutes(chunkId);

    if (routes.length === 0) {
        return new NextResponse("Chunk not found", { status: 404 });
    }

    const xml = wrapInUrlset(routes);

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error generating artist sitemap chunk:", error);
    return new NextResponse("Error generating sitemap", { status: 500 });
  }
}
