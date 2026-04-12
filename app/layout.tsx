import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";
import ChristmasSnow from "@/components/ChristmasSnow";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Serika.art - Modern Art Image Board | 1.5M+ Artworks",
    template: "%s | Serika.art",
  },
  description: "Discover and share over 1.5 million artworks on Serika.art - a modern, clean image board for artists and art enthusiasts. Featuring powerful tagging, ratings, favorites, and community engagement.",
  keywords: [
    "image board", "art sharing", "booru", "anime art", "community", "tags", "artwork",
    "illustration", "digital art", "fan art", "artists", "characters", "anime", "manga",
    "wallpapers", "art gallery", "image gallery", "art community"
  ],
  authors: [{ name: "Serika", url: "https://serika.art" }],
  creator: "Serika",
  publisher: "Serika.art",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://serika.art"),
  alternates: {
    canonical: "https://serika.art",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://serika.art",
    title: "Serika.art - Modern Art Image Board | 1.5M+ Artworks",
    description: "Discover and share over 1.5 million artworks. A modern, clean image board with powerful tagging, ratings, and community features.",
    siteName: "Serika.art",
    images: [
      {
        url: "https://serika.art/og-image",
        width: 1200,
        height: 630,
        alt: "Serika.art - Modern Art Image Board",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@serika_art",
    creator: "@serika_art",
    title: "Serika.art - Modern Art Image Board",
    description: "Discover and share over 1.5 million artworks",
    images: {
      url: "https://serika.art/og-image",
      alt: "Serika.art - Modern Art Image Board",
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    // Add your verification codes when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
  category: "art",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Serika.art",
  },
  other: {
    "theme-color": "#09090b",
    "color-scheme": "dark",
    "msapplication-TileColor": "#09090b",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#09090b" />
        <script async type="application/javascript" src="https://a.magsrv.com/ad-provider.js"></script>
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased flex flex-col", inter.className)}>
        <ChristmasSnow />
        <StructuredData />
        <AuthProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
