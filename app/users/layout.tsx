import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Members | Serika.art",
  description: "Browse the Serika.art community. Find artists, uploaders, and art enthusiasts on the largest modern art image board with 1.5M+ artworks.",
  keywords: ["serika users", "art community", "anime artists", "digital artists", "art uploaders", "art community members"],
  alternates: {
    canonical: "https://serika.art/users",
  },
  openGraph: {
    title: "Community Members | Serika.art",
    description: "Browse the Serika.art community of artists and art enthusiasts.",
    type: "website",
    url: "https://serika.art/users",
    siteName: "Serika.art",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
