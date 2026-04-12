import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Serika.art",
  description: "Get in touch with the Serika.art team. Report bugs, request features, or ask questions about our art image board with over 1.5 million artworks.",
  keywords: ["contact serika", "serika support", "art image board contact", "report bug", "feature request"],
  alternates: {
    canonical: "https://serika.art/contact",
  },
  openGraph: {
    title: "Contact Us | Serika.art",
    description: "Get in touch with the Serika.art team for support, bug reports, and feature requests.",
    type: "website",
    url: "https://serika.art/contact",
    siteName: "Serika.art",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
