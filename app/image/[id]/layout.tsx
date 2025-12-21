import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

async function getImageMetadata(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://serika.art";
    const response = await fetch(`${baseUrl}/api/images/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.image;
  } catch (error) {
    return null;
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
    };
  }

  const tagNames = image.tags
    .map((tag: any) => {
      if (typeof tag === "string") return tag;
      return tag?.name || "";
    })
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");

  const title = `${tagNames || "Image"} | Serika.art`;
  const description = image.description
    ? `${image.description.substring(0, 155)}...`
    : `View this ${image.rating} artwork on Serika.art featuring: ${tagNames}`;

  return {
    title,
    description,
    keywords: [
      ...image.tags
        .map((t: any) => (typeof t === "string" ? t : t?.name))
        .filter(Boolean),
      image.rating,
      "artwork",
      "image",
    ],
    openGraph: {
      type: "website",
      url: `https://serika.art/image/${id}`,
      title,
      description,
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: tagNames || "Artwork",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
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
