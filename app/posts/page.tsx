'use client';

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Image, Tag } from '@/lib/models';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Loader2, Hash, TrendingUp, X, Search, Shield, AlertTriangle, Ban, Filter, SlidersHorizontal, Sparkles, Bot, EyeOff, Eye, Palette, User } from 'lucide-react';
import Link from 'next/link';
import { getRatingsFromCookie, setRatingsCookie, toggleRating as toggleRatingUtil, Rating } from '@/lib/ratingPreferences';
import { getBlacklistedTags, isBlacklistEnabled, setBlacklistEnabled, shouldHideImage } from '@/lib/blacklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';

// Grid size CSS class mapping
const gridSizeClasses = {
  small: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  medium: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
};

function PostsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [tagsByType, setTagsByType] = useState<Record<TagType, Tag[]>>({
    general: [],
    artist: [],
    character: [],
    copyright: [],
    meta: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState<Rating[]>(['safe']);
  const [ratingsInitialized, setRatingsInitialized] = useState(false);
  const [hideAI, setHideAI] = useState(false);
  const [blacklistEnabled, setBlacklistEnabledState] = useState(true);
  const [blacklistedTags, setBlacklistedTags] = useState<string[]>([]);
  const [postsPerPage, setPostsPerPage] = useState(24);
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [artistTagInfo, setArtistTagInfo] = useState<{ name: string; tagId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Get parameters from URL
  const urlPage = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const tagsParam = searchParams.get('tags') || '';
  const uploaderParam = searchParams.get('uploader') || '';
  
  // Use URL page for pagination mode, internal state for infinite scroll
  const page = infiniteScroll ? currentPage : urlPage;
  
  const selectedTags = tagsParam 
    ? tagsParam.split(',').map((tag) => ({ name: tag.trim(), type: 'general' as TagType }))
    : [];

  // Initialize settings from localStorage/cookies on mount
  useEffect(() => {
    const cookieRatings = getRatingsFromCookie();
    setSelectedRatings(cookieRatings);
    setBlacklistEnabledState(isBlacklistEnabled());
    setBlacklistedTags(getBlacklistedTags());
    
    // Load hideAI setting from localStorage
    const savedHideAI = localStorage.getItem('serika_hide_ai_default');
    if (savedHideAI === 'true') {
      setHideAI(true);
    }
    
    // Load posts per page setting
    const savedPostsPerPage = localStorage.getItem('serika_posts_per_page');
    if (savedPostsPerPage) {
      setPostsPerPage(parseInt(savedPostsPerPage) || 24);
    }
    
    // Load grid size setting
    const savedGridSize = localStorage.getItem('serika_grid_size');
    if (savedGridSize && ['small', 'medium', 'large'].includes(savedGridSize)) {
      setGridSize(savedGridSize as 'small' | 'medium' | 'large');
    }
    
    // Load infinite scroll setting
    const savedInfiniteScroll = localStorage.getItem('serika_infinite_scroll');
    if (savedInfiniteScroll === 'true') {
      setInfiniteScroll(true);
    }
    
    setRatingsInitialized(true);
  }, []);

  useEffect(() => {
    if (ratingsInitialized) {
      fetchImages();
    }
  }, [page, sort, tagsParam, uploaderParam, selectedRatings, ratingsInitialized, hideAI, postsPerPage]);

  // Reset allImages when filters change (for infinite scroll)
  useEffect(() => {
    if (infiniteScroll) {
      setAllImages([]);
      setCurrentPage(1);
    }
  }, [sort, tagsParam, uploaderParam, selectedRatings, hideAI, infiniteScroll]);

  // Check if filtering by a single artist tag
  useEffect(() => {
    const checkArtistTag = async () => {
      if (selectedTags.length === 1) {
        try {
          const res = await axios.get(`/api/tags/${encodeURIComponent(selectedTags[0].name)}`);
          if (res.data.success && res.data.tag?.type === 'artist') {
            setArtistTagInfo({ name: res.data.tag.name, tagId: res.data.tag._id });
          } else {
            setArtistTagInfo(null);
          }
        } catch {
          setArtistTagInfo(null);
        }
      } else {
        setArtistTagInfo(null);
      }
    };
    checkArtistTag();
  }, [tagsParam]);

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!infiniteScroll || !loadMoreRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && currentPage < totalPages) {
          loadMoreImages();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [infiniteScroll, loading, loadingMore, currentPage, totalPages]);

  const loadMoreImages = async () => {
    if (loadingMore || currentPage >= totalPages) return;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const tagsQueryParam = selectedTags.length
        ? `&tags=${selectedTags.map(t => encodeURIComponent(t.name)).join(',')}`
        : '';
      const ratingsQueryParam = `&ratings=${selectedRatings.join(',')}`;
      const hideAIParam = hideAI ? '&hideAI=true' : '';
      const uploaderQueryParam = uploaderParam ? `&username=${encodeURIComponent(uploaderParam)}` : '';
      const response = await axios.get(`/api/images?page=${nextPage}&limit=${postsPerPage}&sort=${sort}${tagsQueryParam}${ratingsQueryParam}${hideAIParam}${uploaderQueryParam}`);
      
      if (response.data.success) {
        setAllImages(prev => [...prev, ...response.data.images]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more images:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (tagInput.trim().length > 0) {
      fetchTagSuggestions();
    } else {
      setTagSuggestions([]);
      setShowSuggestions(false);
    }
  }, [tagInput]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const tagsQueryParam = selectedTags.length
        ? `&tags=${selectedTags.map(t => encodeURIComponent(t.name)).join(',')}`
        : '';
      const ratingsQueryParam = `&ratings=${selectedRatings.join(',')}`;
      const hideAIParam = hideAI ? '&hideAI=true' : '';
      const uploaderQueryParam = uploaderParam ? `&username=${encodeURIComponent(uploaderParam)}` : '';
      const response = await axios.get(`/api/images?page=${page}&limit=${postsPerPage}&sort=${sort}${tagsQueryParam}${ratingsQueryParam}${hideAIParam}${uploaderQueryParam}`);
      if (response.data.success) {
        setImages(response.data.images);
        // For infinite scroll, set allImages on initial load
        if (infiniteScroll && page === 1) {
          setAllImages(response.data.images);
        } else if (infiniteScroll && allImages.length === 0) {
          setAllImages(response.data.images);
        }
        setTotalPages(response.data.pagination.pages);
        setTotalImages(response.data.pagination.total);
        // Extract and organize tags from current page
        extractTagsFromImages(response.data.images);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractTagsFromImages = (pageImages: Image[]) => {
    const tagMap: Record<string, { count: number; type: TagType; _id: string }> = {};
    
    // Collect unique tags from current page images (using database count, not page count)
    pageImages.forEach(image => {
      image.tags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : (tag && 'name' in tag) ? (tag as any).name : null;
        const tagType = typeof tag === 'object' && 'type' in tag ? (tag as any).type : 'general';
        const tagId = (tag && typeof tag === 'object' && '_id' in tag) ? (tag as any)._id : null;
        // Use the database count, not page count
        const tagCount = (tag && typeof tag === 'object' && 'count' in tag) ? (tag as any).count : 0;
        
        if (tagName && tagId && !tagMap[tagName]) {
          tagMap[tagName] = { count: tagCount, type: tagType || 'general', _id: tagId };
        }
      });
    });

    // Organize by type
    const organized: Record<TagType, any[]> = {
      general: [],
      artist: [],
      character: [],
      copyright: [],
      meta: [],
    };

    Object.entries(tagMap).forEach(([name, data]) => {
      organized[data.type].push({
        name,
        type: data.type,
        count: data.count,
        _id: data._id,
      });
    });

    // Sort by total count (database count) and limit
    organized.artist = organized.artist.sort((a, b) => b.count - a.count).slice(0, 5);
    organized.character = organized.character.sort((a, b) => b.count - a.count).slice(0, 5);
    organized.copyright = organized.copyright.sort((a, b) => b.count - a.count).slice(0, 5);
    organized.general = organized.general.sort((a, b) => b.count - a.count).slice(0, 10);

    setTagsByType(organized);
  };

  const fetchPopularTags = async () => {
    try {
      const response = await axios.get('/api/tags?limit=100');
      if (response.data.success && response.data.grouped) {
        setTagsByType(response.data.grouped);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchTagSuggestions = async () => {
    try {
      const response = await axios.post('/api/tags', { 
        query: tagInput.trim(), 
        limit: 20 
      });
      if (response.data.success) {
        setTagSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const updateUrl = (newTags?: string[], newSort?: string, newPage?: number, newUploader?: string) => {
    const params = new URLSearchParams();
    
    const tagsToUse = newTags !== undefined ? newTags : selectedTags.map(t => t.name);
    const sortToUse = newSort || sort;
    const pageToUse = newPage || 1;
    const uploaderToUse = newUploader !== undefined ? newUploader : uploaderParam;
    
    if (pageToUse > 1) params.set('page', pageToUse.toString());
    if (sortToUse !== 'newest') params.set('sort', sortToUse);
    if (tagsToUse.length > 0) params.set('tags', tagsToUse.join(','));
    if (uploaderToUse) params.set('uploader', uploaderToUse);
    // Ratings are now stored in cookies, not URL
    
    const queryString = params.toString();
    router.push(`/posts${queryString ? '?' + queryString : ''}`);
  };

  const addTag = (tag: Tag) => {
    if (!selectedTags.some(t => t.name === tag.name)) {
      const newTags = [...selectedTags.map(t => t.name), tag.name];
      updateUrl(newTags, sort, 1);
    }
    setTagInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagName: string) => {
    const newTags = selectedTags.filter(t => t.name !== tagName).map(t => t.name);
    updateUrl(newTags, sort, 1);
  };

  const clearFilters = () => {
    router.push('/posts');
  };

  const toggleTag = (tag: Tag | { name: string; type: TagType }) => {
    const newTags = selectedTags.map(t => t.name);
    const exists = newTags.includes(tag.name);
    if (exists) {
      updateUrl(newTags.filter(name => name !== tag.name), sort, 1);
    } else {
      updateUrl([...newTags, tag.name], sort, 1);
    }
  };

  const toggleRating = (rating: Rating) => {
    const newRatings = toggleRatingUtil(selectedRatings, rating);
    setSelectedRatings(newRatings);
    setRatingsCookie(newRatings);
  };

  const typeColors: Record<TagType, string> = {
    artist: 'text-red-400',
    copyright: 'text-purple-400',
    character: 'text-green-400',
    general: 'text-blue-400',
    meta: 'text-yellow-400',
  };

  const tagBadgeColors: Record<TagType, string> = {
    artist: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
    copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
    character: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
    general: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
    meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
  };

  // Sidebar content component for reuse - memoized to prevent input refocus
  const SidebarContent = useMemo(() => (
    <div className="space-y-6">
      {/* Tag Search */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          Search Tags
        </h3>
        <div className="relative">
          <input
            type="text"
            defaultValue=""
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Type to search..."
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {showSuggestions && tagSuggestions.length > 0 && (
            <Card className="absolute z-[110] w-full mt-1 max-h-64 overflow-hidden shadow-2xl border-primary/20">
              <ScrollArea className="max-h-64">
                <div className="p-1">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.name}
                      onClick={() => addTag(tag)}
                      className="w-full px-3 py-2 text-left hover:bg-accent rounded-sm transition-colors flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{tag.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium", typeColors[tag.type || 'general'])}>
                          {tag.type || 'general'}
                        </span>
                        <span className="text-xs text-muted-foreground">{tag.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>

      <Separator />

      {/* Uploader Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Filter by Uploader
        </h3>
        <div className="relative">
          <Input
            type="text"
            value={uploaderParam}
            onChange={(e) => updateUrl(undefined, undefined, 1, e.target.value)}
            placeholder="Enter username..."
            className="h-9"
          />
          {uploaderParam && (
            <button
              onClick={() => updateUrl(undefined, undefined, 1, '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {uploaderParam && (
          <div className="text-xs text-muted-foreground">
            Showing posts by <span className="font-medium text-primary">{uploaderParam}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Content Ratings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Content Rating
        </h3>
        <div className="space-y-1.5">
          {[
            { rating: 'safe' as Rating, icon: Shield, label: 'Safe', color: 'text-green-400', activeClass: 'border-green-500/50 bg-green-500/10' },
            { rating: 'questionable' as Rating, icon: AlertTriangle, label: 'Questionable', color: 'text-yellow-400', activeClass: 'border-yellow-500/50 bg-yellow-500/10' },
            { rating: 'explicit' as Rating, icon: Ban, label: 'Explicit', color: 'text-red-400', activeClass: 'border-red-500/50 bg-red-500/10' },
          ].map(({ rating, icon: Icon, label, color, activeClass }) => (
            <button
              key={rating}
              onClick={() => toggleRating(rating)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md border transition-all text-sm",
                selectedRatings.includes(rating)
                  ? activeClass
                  : "border-transparent opacity-50 hover:opacity-75 hover:bg-muted"
              )}
            >
              <Icon className={cn("h-4 w-4", color)} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* AI Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          AI Content
        </h3>
        <button
          onClick={() => setHideAI(!hideAI)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md border transition-all text-sm",
            hideAI
              ? "border-purple-500/50 bg-purple-500/10"
              : "border-transparent opacity-50 hover:opacity-75 hover:bg-muted"
          )}
        >
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="font-medium">Hide AI Generated</span>
        </button>
      </div>

      <Separator />

      {/* Blacklist Toggle */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          Tag Blacklist
        </h3>
        <div className={cn(
          "flex items-center justify-between px-3 py-2 rounded-md border transition-all",
          blacklistEnabled && blacklistedTags.length > 0
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-transparent bg-muted/50"
        )}>
          <div className="flex items-center gap-2">
            {blacklistEnabled ? (
              <EyeOff className="h-4 w-4 text-amber-400" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <span className="text-sm font-medium">
                {blacklistEnabled ? 'Active' : 'Disabled'}
              </span>
              {blacklistedTags.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({blacklistedTags.length} tags)
                </span>
              )}
            </div>
          </div>
          <Switch
            checked={blacklistEnabled}
            onCheckedChange={(checked) => {
              setBlacklistEnabled(checked);
              setBlacklistEnabledState(checked);
            }}
          />
        </div>
        <Link 
          href="/settings" 
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          Manage blacklisted tags →
        </Link>
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Active Filters</h3>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground">
                Clear all
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag.name}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 cursor-pointer bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  onClick={() => removeTag(tag.name)}
                >
                  {tag.name}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Tags by Type */}
      <div className="space-y-5">
        {(['artist', 'copyright', 'character', 'general'] as TagType[]).map((type) => {
          const tags = tagsByType[type] || [];
          if (tags.length === 0) return null;

          return (
            <div key={type} className="space-y-2">
              <h4 className={cn("text-xs font-semibold uppercase tracking-wider", typeColors[type])}>
                {type}
              </h4>
              <div className="space-y-0.5">
                {tags.map((tag) => {
                  const isSelected = selectedTags.some(t => t.name === tag.name);
                  return (
                    <div key={tag.name} className="space-y-0.5">
                      <button
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-all flex items-center justify-between group",
                          isSelected
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <span className="truncate">{tag.name}</span>
                        <span className={cn(
                          "text-xs tabular-nums ml-2 transition-colors",
                          isSelected ? "text-primary/70" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                        )}>
                          {tag.count}
                        </span>
                      </button>
                      {/* Artist page link for artist tags when selected */}
                      {type === 'artist' && isSelected && (
                        <Link
                          href={`/artist/${encodeURIComponent(tag.name)}`}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <span>Go to artist page</span>
                          <span>→</span>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ), [tagSuggestions, showSuggestions, selectedRatings, hideAI, selectedTags, tagsByType, blacklistEnabled, blacklistedTags, uploaderParam]);

  // Filter images based on blacklist - use allImages for infinite scroll, images for pagination
  const filteredImages = useMemo(() => {
    const sourceImages = infiniteScroll && allImages.length > 0 ? allImages : images;
    if (!blacklistEnabled || blacklistedTags.length === 0) {
      return sourceImages;
    }
    return sourceImages.filter(image => !shouldHideImage(image.tags as unknown as (string | { name: string })[]));
  }, [images, allImages, infiniteScroll, blacklistEnabled, blacklistedTags]);

  return (
    <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-8 max-w-[1800px] mx-auto">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20">
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            {SidebarContent}
          </ScrollArea>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Posts</h1>
              <p className="text-muted-foreground">
                {totalImages > 0 ? `${totalImages.toLocaleString()} images` : 'Discover amazing artwork'}
              </p>
            </div>
            {/* Artist Page Button */}
            {artistTagInfo && (
              <Link href={`/artist/${encodeURIComponent(artistTagInfo.name)}`}>
                <Button className="bg-red-600 hover:bg-red-700 gap-2">
                  <Palette className="h-4 w-4" />
                  View {artistTagInfo.name.replace(/_/g, ' ')}'s Artist Page
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center justify-between gap-4 mb-6 sticky top-16 z-40 bg-background py-3 -mx-4 px-4 border-b border-border/40">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Mobile Filter Button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {selectedTags.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {selectedTags.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
                  {SidebarContent}
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {/* Sort Select */}
            <Select value={sort} onValueChange={(value) => updateUrl(undefined, value, 1)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="favorites">Most Favorited</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
                <SelectItem value="comments">Most Comments</SelectItem>
                <SelectItem value="alphabetical">Artist A-Z</SelectItem>
                <SelectItem value="alphabetical-reverse">Artist Z-A</SelectItem>
                <SelectItem value="random">Random</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active filter badges on desktop */}
          {selectedTags.length > 0 && (
            <div className="hidden md:flex items-center gap-2 flex-wrap justify-end">
              {selectedTags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.name}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 cursor-pointer"
                  onClick={() => removeTag(tag.name)}
                >
                  {tag.name}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
              {selectedTags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{selectedTags.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-8">
            {/* Image Grid Skeleton */}
            <div className={`grid ${gridSizeClasses[gridSize]} gap-3 sm:gap-4`}>
              {Array.from({ length: postsPerPage }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border/40 bg-card/50">
                  {/* Image Area Skeleton */}
                  <div className="relative aspect-square bg-muted">
                    <Skeleton className="absolute inset-0 rounded-none" />
                    {/* Rating Badge Skeleton */}
                    <Skeleton className="absolute top-3 left-3 h-5 w-16 rounded-full" />
                    {/* AI Badge Skeleton (randomly show on some) */}
                    {i % 3 === 0 && (
                      <Skeleton className="absolute top-3 right-3 h-5 w-10 rounded-full" />
                    )}
                  </div>
                  
                  {/* Card Content Skeleton */}
                  <div className="p-4 space-y-3">
                    {/* Tags Skeleton */}
                    <div className="flex flex-wrap gap-1.5">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                      <Skeleton className="h-5 w-14 rounded-md" />
                      {i % 2 === 0 && <Skeleton className="h-5 w-18 rounded-md" />}
                      {i % 4 === 0 && <Skeleton className="h-5 w-12 rounded-md" />}
                    </div>
                    
                    {/* Stats Skeleton */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-10 rounded" />
                        <Skeleton className="h-4 w-10 rounded" />
                        <Skeleton className="h-4 w-10 rounded" />
                      </div>
                      <Skeleton className="h-4 w-8 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Skeleton */}
            <div className="flex justify-center items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <div className="flex items-center gap-1">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg">No images found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {blacklistEnabled && blacklistedTags.length > 0 && images.length > 0
                ? "All images hidden by your blacklist. Try disabling it temporarily."
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <>
            {/* Image Grid */}
            <div className={`grid ${gridSizeClasses[gridSize]} gap-3 sm:gap-4 mb-8`}>
              {filteredImages.map((image) => (
                <ImageCard key={image._id.toString()} image={image} />
              ))}
            </div>

            {/* Infinite Scroll or Pagination */}
            {infiniteScroll ? (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading more...</span>
                  </div>
                )}
                {!loadingMore && currentPage >= totalPages && filteredImages.length > 0 && (
                  <span className="text-muted-foreground text-sm">No more images to load</span>
                )}
              </div>
            ) : (
              /* Traditional Pagination */
              totalPages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUrl(undefined, undefined, Math.max(1, urlPage - 1))}
                    disabled={urlPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 px-2">
                    <span className="text-sm text-muted-foreground">
                      Page <span className="font-medium text-foreground">{urlPage}</span> of <span className="font-medium text-foreground">{totalPages}</span>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUrl(undefined, undefined, Math.min(totalPages, urlPage + 1))}
                    disabled={urlPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    }>
      <PostsPageContent />
    </Suspense>
  );
}
