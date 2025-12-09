import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET() {
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
        <div style={{ fontSize: "32px", fontWeight: "normal", color: "#a1a1aa" }}>
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
