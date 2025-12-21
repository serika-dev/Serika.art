'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur py-6 px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          © {currentYear} Serika. All rights reserved.
        </p>
        
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/posts" className="hover:text-foreground transition-colors">Posts</Link>
          <Link href="/tags" className="hover:text-foreground transition-colors">Tags</Link>
          <Link href="/api-docs" className="hover:text-foreground transition-colors">API</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link href="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
          <a href="https://serika.dev/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
          <a href="https://serika.dev/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
