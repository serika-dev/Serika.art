import { ImageResponse } from "next/og";
import { randomRows } from "@/lib/imageSearch";

/* eslint-disable @next/next/no-img-element */

export const runtime = "nodejs";
// Rendered on request (Cloudflare caches it), not prerendered at build: a
// random pick at build time could be a huge original and fail the deploy.
export const dynamic = "force-dynamic";

// Each render takes 1.5-3 s of CPU (and is per Cloudflare location): cache a day
const OG_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET() {
  try {
    let backgroundImage: string | null = null;

    // Get a random safe 16:9 image
    const rows = await randomRows<{ url: string }>({
      select: 'i.url',
      // Under 3 MB: the renderer inlines the whole file and chokes on huge originals
      where: `i.rating = 'safe' AND i.deleted = FALSE AND i.width > 0 AND i.height > 0
        AND i.file_size > 0 AND i.file_size < 3000000
        AND (i.width::float / i.height::float) >= 1.7 AND (i.width::float / i.height::float) <= 1.85`,
      params: [],
      limit: 1,
      fullScanFallback: false,
    });
    const imagesResult = { rows };

    if (imagesResult.rows.length > 0) {
      backgroundImage = imagesResult.rows[0].url;
    }

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            position: "relative",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Background image */}
          {backgroundImage ? (
            <img
              src={backgroundImage}
              alt=""
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
              }}
            />
          )}

          {/* Dark overlay */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.4)",
            }}
          />

          {/* Text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              zIndex: 10,
              position: "absolute",
              bottom: "80px",
            }}
          >
            <div
              style={{
                fontSize: "72px",
                fontWeight: "bold",
                color: "white",
                textShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
              }}
            >
              Serika.art
            </div>
            <div
              style={{
                fontSize: "28px",
                color: "rgba(255, 255, 255, 0.9)",
                textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
              }}
            >
              Modern Art Image Board Community
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": OG_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error("OG image error:", error);

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              color: "white",
            }}
          >
            Serika.art
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            Modern Art Image Board Community
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  }
}
