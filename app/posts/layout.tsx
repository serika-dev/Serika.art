import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Artwork | Serika.art",
  description: "Browse and discover beautiful artwork on Serika.art. Filter by tags, ratings, and artists. Join our art community today.",
  openGraph: {
    title: "Browse Artwork | Serika.art",
    description: "Browse and discover beautiful artwork on Serika.art",
    type: "website",
    url: "https://serika.art/posts",
  },
};

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
