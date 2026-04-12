import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DMCA Takedown Request | Serika.art",
  description: "Submit a DMCA copyright takedown request on Serika.art. We take intellectual property rights seriously and respond within 24-48 hours.",
  keywords: ["DMCA", "copyright takedown", "intellectual property", "serika DMCA", "art copyright"],
  alternates: {
    canonical: "https://serika.art/dmca",
  },
  openGraph: {
    title: "DMCA Takedown Request | Serika.art",
    description: "Submit a copyright takedown request. We respond within 24-48 hours.",
    type: "website",
    url: "https://serika.art/dmca",
    siteName: "Serika.art",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DMCALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
