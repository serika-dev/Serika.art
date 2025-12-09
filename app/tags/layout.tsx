import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Tags | Serika.art",
  description: "Explore all tags on Serika.art. Find artists, characters, copyrights, and general tags used across the community. Discover new artwork through tagging.",
  openGraph: {
    title: "Browse Tags | Serika.art",
    description: "Explore all tags on Serika.art and discover artwork",
    type: "website",
    url: "https://serika.art/tags",
  },
};

export default function TagsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
