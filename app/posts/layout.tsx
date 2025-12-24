import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Artwork | Serika.art - 1.5M+ Images",
  description: "Browse over 1.5 million artworks on Serika.art. Filter by tags, ratings, artists, characters & more. Safe, sketchy, and explicit content with powerful filtering.",
  keywords: ["browse artwork", "anime art", "illustrations", "digital art", "art gallery", "image board", "booru", "fan art", "artists", "characters"],
  alternates: {
    canonical: "https://serika.art/posts",
  },
  openGraph: {
    title: "Browse Artwork | Serika.art - 1.5M+ Images",
    description: "Discover over 1.5 million artworks. Filter by tags, ratings, artists, and characters.",
    type: "website",
    url: "https://serika.art/posts",
    siteName: "Serika.art",
    images: [
      {
        url: "https://serika.art/og-image",
        width: 1200,
        height: 630,
        alt: "Serika.art - Browse Artwork",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@serika_art",
    title: "Browse Artwork | Serika.art",
    description: "Discover over 1.5 million artworks with powerful filtering.",
    images: ["https://serika.art/og-image"],
  },
};

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
