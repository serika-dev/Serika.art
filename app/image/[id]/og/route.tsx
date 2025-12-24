import { ImageResponse } from "next/og";

export const runtime = "edge";

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the image data
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://serika.art";
    const response = await fetch(`${baseUrl}/api/images/${id}`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error("Image not found");
    }

    const data = await response.json();
    const image = data.image;

    if (!image) {
      throw new Error("No image data");
    }

    // Extract tags
    const allTags = image.tags
      .map((tag: any) => (typeof tag === 'string' ? tag : tag?.name || ''))
      .filter(Boolean)
      .slice(0, 6);

    const artistTags = image.tags
      .filter((tag: any) => typeof tag === 'object' && tag?.type === 'artist')
      .map((tag: any) => tag.name)
      .slice(0, 2);

    const characterTags = image.tags
      .filter((tag: any) => typeof tag === 'object' && tag?.type === 'character')
      .map((tag: any) => tag.name)
      .slice(0, 3);

    // Stats
    const likes = image.upvotes || 0;
    const views = image.views || 0;
    const favorites = image.favorites || 0;

    // Rating styling
    const ratingColor = image.rating === 'safe' ? '#22c55e' : image.rating === 'sketchy' ? '#eab308' : '#ef4444';
    const ratingLabel = image.rating === 'safe' ? 'Safe' : image.rating === 'sketchy' ? 'Sketchy' : 'Explicit';

    // Build title
    let title = characterTags.length > 0 ? characterTags.join(', ') : allTags.slice(0, 3).join(', ') || 'Artwork';
    if (title.length > 40) title = title.substring(0, 37) + '...';

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#09090b',
            position: 'relative',
          }}
        >
          {/* Background image with blur and overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.thumbnailUrl || image.url}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(30px) brightness(0.3)',
                transform: 'scale(1.2)',
              }}
            />
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              padding: 40,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Left side - Image */}
            <div
              style={{
                display: 'flex',
                width: '55%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                paddingRight: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  maxHeight: '100%',
                  maxWidth: '100%',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.thumbnailUrl || image.url}
                  alt=""
                  style={{
                    maxHeight: 550,
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>

            {/* Right side - Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '45%',
                height: '100%',
                justifyContent: 'center',
                paddingLeft: 20,
                color: 'white',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {/* Rating badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: ratingColor,
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontSize: 18,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}
                >
                  {ratingLabel}
                </div>
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 'bold',
                  marginBottom: 12,
                  lineHeight: 1.2,
                  display: 'flex',
                  flexWrap: 'wrap',
                }}
              >
                {title}
              </div>

              {/* Artist */}
              {artistTags.length > 0 && (
                <div
                  style={{
                    fontSize: 24,
                    color: '#a1a1aa',
                    marginBottom: 24,
                    display: 'flex',
                  }}
                >
                  by {artistTags.join(', ')}
                </div>
              )}

              {/* Stats */}
              <div
                style={{
                  display: 'flex',
                  gap: 32,
                  marginBottom: 24,
                }}
              >
                {/* Likes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>{formatNumber(likes)}</span>
                </div>

                {/* Views */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>{formatNumber(views)}</span>
                </div>

                {/* Favorites */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span style={{ fontSize: 24, fontWeight: 'bold' }}>{formatNumber(favorites)}</span>
                </div>
              </div>

              {/* Tags */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                {allTags.map((tag: string, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      padding: '6px 14px',
                      borderRadius: 16,
                      fontSize: 16,
                      color: '#d4d4d8',
                    }}
                  >
                    {tag}
                  </div>
                ))}
              </div>

              {/* Branding */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: 'auto',
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    color: '#ec4899',
                  }}
                >
                  Serika.art
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: '#71717a',
                    marginLeft: 12,
                  }}
                >
                  #{image.sequentialId || id}
                </div>
              </div>
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
          <div style={{ fontSize: "40px", color: "#ec4899" }}>Serika.art</div>
          <div style={{ fontSize: "24px", color: "#71717a" }}>Image not found</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
