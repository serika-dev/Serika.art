import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Navbar from "@/components/Navbar";
import StructuredData from "@/components/StructuredData";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serika.art - Modern Art Image Board Community",
  description: "Discover and share beautiful artwork on Serika.art - a modern, clean image board for artists and art enthusiasts. Featuring tagging, ratings, and community engagement.",
  keywords: ["image board", "art sharing", "booru", "anime art", "community", "tags", "artwork"],
  authors: [{ name: "Serika" }],
  creator: "Serika",
  metadataBase: new URL("https://serika.art"),
  alternates: {
    canonical: "https://serika.art",
  },
  openGraph: {
    type: "website",
    url: "https://serika.art",
    title: "Serika.art - Modern Art Image Board Community",
    description: "Discover and share beautiful artwork on Serika.art - a modern, clean image board for artists and art enthusiasts.",
    siteName: "Serika.art",
    images: [
      {
        url: "https://serika.art/og-image",
        width: 1200,
        height: 630,
        alt: "Serika.art - Modern Art Image Board",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Serika.art - Modern Art Image Board Community",
    description: "Discover and share beautiful artwork on Serika.art",
    images: ["https://serika.art/og-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#09090b" />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased flex flex-col", inter.className)}>
        <StructuredData />
        <AuthProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 px-6 text-center text-sm text-muted-foreground">
            <div className="flex justify-center gap-6">
              <a href="https://serika.dev/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="https://serika.dev/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
