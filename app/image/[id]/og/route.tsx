import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the image data
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://serika.art";
    const response = await fetch(`${baseUrl}/api/images/${id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Image not found");
    }

    const data = await response.json();
    const image = data.image;

    if (!image) {
      throw new Error("No image data");
    }

    const tagNames = image.tags
      .map((t: any) => (typeof t === "string" ? t : t?.name))
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            fontSize: 50,
            color: "white",
            background: "linear-gradient(135deg, #09090b 0%, #27272a 100%)",
            width: "100%",
            height: "100%",
            padding: "40px",
            textAlign: "center",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ fontSize: "36px", color: "#a1a1aa" }}>
            {tagNames || "Artwork on Serika.art"}
          </div>
          <div style={{ fontSize: "24px", color: "#71717a" }}>
            {image.rating.toUpperCase()} • {image.width}×{image.height}
          </div>
          <div style={{ fontSize: "20px", color: "#52525b" }}>
            Uploaded by {image.username}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    // Fallback OG image
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            fontSize: 60,
            color: "white",
            background: "linear-gradient(135deg, #09090b 0%, #27272a 100%)",
            width: "100%",
            height: "100%",
            padding: "50px",
            textAlign: "center",
            justifyContent: "center",
            alignItems: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: "bold",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ fontSize: "80px" }}>🎨</div>
          <div>Serika.art</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
