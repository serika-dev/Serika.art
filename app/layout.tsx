import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Serika.art - Modern Image Board",
  description: "A clean, modern image board for sharing and discovering art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-50 min-h-screen">
        <AuthProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-64px)]">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
