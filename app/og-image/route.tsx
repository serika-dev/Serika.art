import { ImageResponse } from "next/og";
import { getCollection } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  try {
    const imagesCollection = await getCollection("images");

    let backgroundImage: string | null = null;

    // Get a random safe 16:9 image
    const images = await imagesCollection
      .aggregate([
        {
          $match: {
            rating: "safe",
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                { $gte: [{ $divide: ["$width", "$height"] }, 1.7] },
                { $lte: [{ $divide: ["$width", "$height"] }, 1.85] },
              ],
            },
          },
        },
        { $sample: { size: 1 } },
      ])
      .toArray();

    if (images.length > 0) {
      backgroundImage = images[0].url;
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
      }
    );
  }
}
