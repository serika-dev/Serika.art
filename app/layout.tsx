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
      <body className="bg-zinc-950 text-zinc-50 min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-zinc-800 bg-zinc-900 py-4 px-6 text-center text-sm text-zinc-400">
            <div className="flex justify-center gap-6">
              <a href="https://serika.dev/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200 transition-colors">
                Privacy
              </a>
              <a href="https://serika.dev/terms" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200 transition-colors">
                Terms
              </a>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
