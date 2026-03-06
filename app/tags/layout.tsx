import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Tags | Serika.art - Artists, Characters & More",
  description: "Explore thousands of tags on Serika.art. Find your favorite artists, characters, series, and general tags. Discover new artwork through our comprehensive tagging system.",
  keywords: ["tags", "artists", "characters", "anime series", "copyrights", "art tags", "image tags", "booru tags", "search tags"],
  alternates: {
    canonical: "https://serika.art/tags",
  },
  openGraph: {
    title: "Browse Tags | Serika.art - Artists, Characters & More",
    description: "Explore thousands of tags - artists, characters, series, and more.",
    type: "website",
    url: "https://serika.art/tags",
    siteName: "Serika.art",
    images: [
      {
        url: "https://serika.art/og-image",
        width: 1200,
        height: 630,
        alt: "Serika.art - Browse Tags",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@serika_art",
    title: "Browse Tags | Serika.art",
    description: "Explore thousands of tags - artists, characters, series, and more.",
    images: ["https://serika.art/og-image"],
  },
};

export default function TagsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
