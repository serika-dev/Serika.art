'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';
import { Search, Hash, Users, BookOpen, ImageIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tag } from '@/lib/models';

interface HomePageClientProps {
  imageCount: number;
  tagCount: number;
}

function DigitCounter({ value }: { value: number }) {
  // Themes available on count.getloli.com
  const themes = ['moebooru', 'rule34', 'gelbooru', 'asoul', 'pcr', 'pantabear'];
  
  // Pick a theme based on the current date (rotates daily)
  const getDailyTheme = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return themes[dayOfYear % themes.length];
  };

  const theme = getDailyTheme();
  const counterUrl = `https://count.getloli.com/@serika-art?num=${value}&theme=${theme}&padding=7&scale=2`;
  
  return (
    <div className="flex flex-col items-center justify-center my-8 gap-2">
      <img 
        src={counterUrl} 
        alt={`${value.toLocaleString()} posts`}
        className="h-24 sm:h-32 w-auto pointer-events-none select-none"
        style={{ imageRendering: 'pixelated' }}
        loading="lazy"
      />
      <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">
        Theme: {theme}
      </p>
    </div>
  );
}

export default function HomePageClient({ imageCount, tagCount }: HomePageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const searchContainerRef = useRef<HTMLFormElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch tag suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const response = await axios.post('/api/tags', { 
            query: searchQuery.trim(), 
            limit: 10 
          });
          if (response.data.success) {
            setTagSuggestions(response.data.suggestions);
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error('Error fetching suggestions:', error);
        }
      } else {
        setTagSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/posts?tags=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/posts');
    }
  };

  const handleSelectTag = (tagName: string) => {
    router.push(`/posts?tags=${encodeURIComponent(tagName)}`);
    setSearchQuery(tagName);
    setShowSuggestions(false);
  };

  const typeColors: Record<string, string> = {
    artist: 'text-red-400',
    copyright: 'text-purple-400',
    character: 'text-green-400',
    general: 'text-blue-400',
    meta: 'text-yellow-400',
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-4">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.svg"
            alt="Serika Booru"
            width={240}
            height={52}
            className="h-10 w-auto opacity-90"
            priority
          />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="pt-2 relative" ref={searchContainerRef}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tags... e.g. blue_sky cloud 1girl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim().length > 1 && setShowSuggestions(true)}
                className="pl-10 h-11 rounded-xl bg-card border-border/50 text-base"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="h-11 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 transition-all active:scale-95">
              Search
            </Button>
          </div>

          {/* Tag Suggestions Dropdown */}
          {showSuggestions && tagSuggestions.length > 0 && (
            <Card className="absolute z-[110] w-full mt-2 max-h-64 overflow-hidden shadow-2xl border-primary/20 bg-card/95 backdrop-blur-sm text-left">
              <ScrollArea className="max-h-64">
                <div className="p-1.5">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => handleSelectTag(tag.name)}
                      className="w-full px-3 py-2.5 text-left hover:bg-accent rounded-lg transition-colors flex items-center justify-between text-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className={cn("h-3.5 w-3.5 opacity-40", typeColors[tag.type || 'general'])} />
                        <span className="font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                          {tag.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-muted/50", typeColors[tag.type || 'general'])}>
                          {tag.type || 'general'}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground/60">{tag.count.toLocaleString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </form>

        {/* Image count */}
        <div className="pt-0">
          <DigitCounter value={imageCount} />
          <p className="text-sm text-muted-foreground -mt-4">
            <span className="text-foreground font-bold">{tagCount.toLocaleString()}</span> tags archive
          </p>
        </div>

        {/* Quick links grid */}
        <div className="grid grid-cols-4 gap-2 pt-4">
          <Link href="/posts" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group">
            <ImageIcon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-muted-foreground">Browse</span>
          </Link>
          <Link href="/tags" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group">
            <Hash className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-muted-foreground">Tags</span>
          </Link>
          <Link href="/users" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group">
            <Users className="h-4 w-4 text-green-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-muted-foreground">Users</span>
          </Link>
          <Link href="/api-docs" className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/30 transition-all group">
            <BookOpen className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-muted-foreground">API</span>
          </Link>
        </div>

        {/* SEO Rich Text Section (Visually subtle for search engines) */}
        <section className="sr-only">
          <h2>Serika Booru - The Ultimate Anime Art Image Board</h2>
          <p>
            Welcome to Serika.art, also known as Serika Booru. We are a premier digital art archive and 
            anime image board hosting over {imageCount.toLocaleString()} high-quality artworks. 
            Whether you are looking for Serika Art, character illustrations, or beautiful digital paintings, 
            our platform offers an advanced tagging system inspired by Danbooru and Gelbooru.
          </p>
          <p>
            Explore our vast collection of {tagCount.toLocaleString()} tags to find your favorite artists 
            and characters. Serika Booru is optimized for speed and discovery, making it the best 
            alternative for fans of Konachan, Yande.re, and Safebooru.
          </p>
        </section>

        {/* Footer */}
        <div className="pt-4 pb-8 flex items-center justify-center gap-3 text-xs text-muted-foreground/60">
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <span>·</span>
          <Link href="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
          <span>·</span>
          <a href="https://discord.gg/serika" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
        </div>
      </div>
    </div>
  );
}
