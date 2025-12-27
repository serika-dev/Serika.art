'use client';

import { useState, useEffect } from 'react';
import { Tag as TagModel } from '@/lib/models';
import axios from 'axios';
import Link from 'next/link';
import { Hash, Search, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';

export default function TagsPage() {
  const [tags, setTags] = useState<TagModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TagType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTags();
  }, [filter, searchQuery]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (filter !== 'all') params.set('type', filter);
      params.set('limit', '500');

      const response = await axios.get(`/api/tags?${params.toString()}`);
      if (response.data.success) {
        setTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const tagTypeStyles: Record<TagType, string> = {
    artist: 'bg-red-600/20 text-red-300 border-red-500/40 hover:bg-red-600/30 hover:border-red-500/50',
    copyright: 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30 hover:border-purple-500/50',
    character: 'bg-green-600/20 text-green-300 border-green-500/40 hover:bg-green-600/30 hover:border-green-500/50',
    general: 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30 hover:border-blue-500/50',
    meta: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-600/30 hover:border-yellow-500/50',
  };

  const filterOptions: { value: TagType | 'all'; label: string; color?: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'general', label: 'General', color: 'text-blue-400' },
    { value: 'artist', label: 'Artist', color: 'text-red-400' },
    { value: 'character', label: 'Character', color: 'text-green-400' },
    { value: 'copyright', label: 'Copyright', color: 'text-purple-400' },
    { value: 'meta', label: 'Meta', color: 'text-yellow-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Hash className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
        </div>
        <p className="text-muted-foreground">Browse and search all available tags</p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-background"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(option.value)}
              className={cn(
                "transition-all",
                filter !== option.value && option.color && option.color
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!loading && tags.length > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing <span className="font-medium text-foreground">{tags.length}</span> tags
        </p>
      )}

      {/* Tags Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-lg">No tags found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div key={tag._id.toString()} className="group relative">
              <Link
                href={`/posts?tags=${encodeURIComponent(tag.name)}`}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-sm font-medium transition-all inline-flex items-center gap-2",
                  tagTypeStyles[tag.type]
                )}
              >
                <span>{tag.name}</span>
                <span className="text-xs opacity-60">
                  {tag.count}
                </span>
              </Link>
              {/* Artist page link for artist tags */}
              {tag.type === 'artist' && (
                <Link
                  href={`/artist/${encodeURIComponent(tag.name)}`}
                  className="absolute -top-1 -right-1 p-1 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                  title="View artist page"
                >
                  →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
