import type { Metadata } from "next";
import { Suspense } from "react";

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
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}
