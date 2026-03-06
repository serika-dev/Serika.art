import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

async function getImageMetadata(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://serika.art";
    const response = await fetch(`${baseUrl}/api/images/${id}`, {
      next: { revalidate: 60 }, // Revalidate every minute for fresh stats
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.image;
  } catch (error) {
    return null;
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getRatingLabel(rating: string): string {
  switch (rating) {
    case 'safe': return 'Safe';
    case 'sketchy': return 'Sketchy';
    case 'explicit': return 'Explicit';
    default: return rating;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const image = await getImageMetadata(id);

  if (!image) {
    return {
      title: "Image Not Found | Serika.art",
      description: "This image doesn't exist or has been deleted.",
      robots: { index: false, follow: false },
    };
  }

  // Extract tag names properly
  const allTags = image.tags
    .map((tag: any) => {
      if (typeof tag === "string") return tag;
      return tag?.name || "";
    })
    .filter(Boolean);

  // Get artist tags
  const artistTags = image.tags
    .filter((tag: any) => (typeof tag === 'object' && tag?.type === 'artist'))
    .map((tag: any) => tag.name)
    .slice(0, 3);

  // Get character tags
  const characterTags = image.tags
    .filter((tag: any) => (typeof tag === 'object' && tag?.type === 'character'))
    .map((tag: any) => tag.name)
    .slice(0, 3);

  // Get copyright tags
  const copyrightTags = image.tags
    .filter((tag: any) => (typeof tag === 'object' && tag?.type === 'copyright'))
    .map((tag: any) => tag.name)
    .slice(0, 2);

  const displayTags = allTags.slice(0, 8);
  const tagString = displayTags.join(", ");

  // Build a rich title
  let title = "";
  if (characterTags.length > 0) {
    title = characterTags.join(", ");
    if (copyrightTags.length > 0) {
      title += ` (${copyrightTags.join(", ")})`;
    }
  } else if (copyrightTags.length > 0) {
    title = copyrightTags.join(", ");
  } else {
    title = displayTags.slice(0, 3).join(", ") || "Artwork";
  }
  
  if (artistTags.length > 0) {
    title += ` by ${artistTags.join(", ")}`;
  }

  title = title.substring(0, 60);
  const fullTitle = `${title} | Serika.art`;

  // Stats for description
  const likes = image.upvotes || 0;
  const views = image.views || 0;
  const favorites = image.favorites || 0;
  const rating = getRatingLabel(image.rating);

  // Build rich description with stats - Discord shows this!
  const statsLine = `${formatNumber(likes)} likes • ${formatNumber(views)} views • ${formatNumber(favorites)} favorites`;
  
  let description = "";
  if (image.description) {
    description = `${image.description.substring(0, 120)}...\n\n${statsLine}`;
  } else {
    description = `${rating} artwork on Serika.art\n${tagString}\n\n${statsLine}`;
  }

  // Use the dedicated OG image endpoint for this specific image
  const ogImageUrl = `https://serika.art/image/${id}/og`;

  return {
    title: fullTitle,
    description: description.substring(0, 200),
    keywords: [
      ...allTags.slice(0, 20),
      image.rating,
      "artwork",
      "art",
      "image",
      "illustration",
      "serika",
      ...(artistTags.length > 0 ? ["artist", ...artistTags] : []),
      ...(characterTags.length > 0 ? ["character", ...characterTags] : []),
      ...(copyrightTags.length > 0 ? ["anime", "manga", ...copyrightTags] : []),
    ],
    authors: artistTags.length > 0 ? artistTags.map((a: string) => ({ name: a })) : undefined,
    creator: artistTags[0] || "Unknown Artist",
    publisher: "Serika.art",
    alternates: {
      canonical: `https://serika.art/image/${id}`,
    },
    openGraph: {
      type: "article",
      url: `https://serika.art/image/${id}`,
      title: fullTitle,
      description,
      siteName: "Serika.art",
      publishedTime: image.createdAt,
      modifiedTime: image.updatedAt || image.createdAt,
      authors: artistTags.length > 0 ? artistTags : undefined,
      tags: displayTags,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/png",
        },
        {
          url: image.url,
          width: image.width || 1200,
          height: image.height || 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@serika_art",
      creator: artistTags[0] ? `@${artistTags[0]}` : undefined,
      title: fullTitle,
      description,
      images: {
        url: ogImageUrl,
        alt: title,
      },
    },
    other: {
      // Discord-specific meta tags
      "theme-color": image.rating === 'safe' ? "#22c55e" : image.rating === 'sketchy' ? "#eab308" : "#ef4444",
      // oEmbed for rich Discord embeds
      "og:image:alt": title,
      "og:locale": "en_US",
      // Article metadata
      "article:published_time": image.createdAt,
      "article:author": artistTags[0] || "Anonymous",
      "article:section": "Artwork",
      "article:tag": displayTags.join(","),
    },
  };
}

export default function ImageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-muted/50 border px-4 py-2 rounded-lg flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
              <Skeleton className="w-full rounded-xl" style={{ minHeight: "60vh" }} />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
