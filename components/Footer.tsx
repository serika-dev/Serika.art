import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur py-4 sm:py-6 px-3 sm:px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-zinc-400">
          © {currentYear} Serika. All rights reserved.
        </p>
        
        <div className="flex items-center justify-center flex-wrap gap-x-2 sm:gap-x-3 text-xs sm:text-sm text-zinc-300">
          <Link href="/posts" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Posts</Link>
          <Link href="/tags" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Tags</Link>
          <Link href="/artists" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Artists</Link>
          <Link href="/guidelines/tagging" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Tagging guidelines</Link>
          <Link href="/api-docs" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">API</Link>
          <a href="https://issues.serika.dev/issues/new?project=serika-art" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Report a bug</a>
          <Link href="/contact" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Contact</Link>
          <Link href="/dmca" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">DMCA</Link>
          <a href="https://serika.dev/terms" target="_blank" rel="noopener noreferrer" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Terms</a>
          <a href="https://serika.dev/privacy" target="_blank" rel="noopener noreferrer" className="inline-block rounded px-1.5 py-1.5 hover:text-foreground transition-colors">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
