'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Image, Tag } from '@/lib/models';
import axios from 'axios';
import { Loader2, X, Search, Shield, AlertTriangle, Ban, SlidersHorizontal, Sparkles, Bot, EyeOff, Eye, Palette, User, Minus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { normalizeTagName } from '@/lib/tagName';
import Link from 'next/link';
import { getRatingsFromCookie, setRatingsCookie, toggleRating as toggleRatingUtil, Rating } from '@/lib/ratingPreferences';
import { getBlacklistedTags, isBlacklistEnabled, setBlacklistEnabled, shouldHideImage } from '@/lib/blacklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import NativeAd from '@/components/NativeAd';
import { buildImagesQuery } from '@/lib/postsQuery';

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';

// Grid size CSS class mapping
const gridSizeClasses = {
  small: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  medium: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
};

interface InitialPosts {
  images: Image[];
  pagination: { pages: number; total: number };
}

interface PostsPageProps {
  /** Query string the server used for `initialData` (see lib/postsQuery). */
  initialQuery?: string;
  /** First page rendered on the server, so thumbnails load with the HTML. */
  initialData?: InitialPosts;
}

/** Top tags of a page of images, grouped by type, for the sidebar. */
function organizeTags(pageImages: Image[]): Record<TagType, Tag[]> {
  const tagMap: Record<string, { count: number; type: TagType; _id: string }> = {};
  for (const image of pageImages) {
    for (const tag of image.tags || []) {
      const t = tag as any;
      const name = typeof t === 'string' ? t : t?.name;
      const id = t && typeof t === 'object' ? t.id || t._id : null;
      if (name && id && !tagMap[name]) tagMap[name] = { count: t.count || 0, type: (t.type || 'general') as TagType, _id: id };
    }
  }
  const organized: Record<TagType, any[]> = { general: [], artist: [], character: [], copyright: [], meta: [] };
  for (const [name, data] of Object.entries(tagMap)) {
    (organized[data.type] ?? organized.general).push({ name, type: data.type, count: data.count, _id: data._id });
  }
  const top = (list: any[], n: number) => list.sort((a, b) => b.count - a.count).slice(0, n);
  return {
    artist: top(organized.artist, 5),
    character: top(organized.character, 5),
    copyright: top(organized.copyright, 5),
    general: top(organized.general, 10),
    meta: [],
  };
}

function PostsPageContent({ initialQuery, initialData }: PostsPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [images, setImages] = useState<Image[]>(initialData?.images ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [totalPages, setTotalPages] = useState(initialData?.pagination.pages ?? 1);
  const [totalImages, setTotalImages] = useState(initialData?.pagination.total ?? 0);
  // Which server-rendered payload has already been applied (one per navigation)
  const consumedInitialRef = useRef<InitialPosts | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  // Built from the server-rendered page right away, so the sidebar's tag links are in the HTML
  const [tagsByType, setTagsByType] = useState<Record<TagType, Tag[]>>(() => organizeTags(initialData?.images ?? []));
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Desktop filter sidebar can be collapsed to a rail; remembered per browser
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem('serika_posts_sidebar') === 'collapsed'); } catch {}
  }, []);
  const toggleSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    try { localStorage.setItem('serika_posts_sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
  };
  // Tag types seen so far (page results, suggestions) – colours the search chips
  const tagTypes = useRef(new Map<string, TagType>());
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
            setArtistTagInfo({ name: res.data.tag.name, tagId: res.data.tag.id || res.data.tag._id });
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
      const response = await axios.get(`/api/images?${imagesQuery(nextPage)}`);
      
      if (response.data.success) {
        // allImages is still empty when page 1 came from the server render
        setAllImages(prev => [...(prev.length ? prev : images), ...response.data.images]);
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more images:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // A leading "-" means exclude; suggest on the tag name after it
    if (tagInput.trim().replace(/^-/, '').length === 0) {
      setTagSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Debounce so we don't fire a request on every keystroke.
    const t = setTimeout(() => fetchTagSuggestions(), 250);
    return () => clearTimeout(t);
  }, [tagInput]);

  const imagesQuery = (forPage: number) => buildImagesQuery({
    page: forPage,
    limit: postsPerPage,
    sort,
    tags: selectedTags.map(t => t.name),
    ratings: selectedRatings,
    hideAI,
    uploader: uploaderParam,
  });

  const fetchImages = async () => {
    const queryString = imagesQuery(page);

    // The server already rendered exactly this page – use it instead of refetching
    if (initialData && initialQuery === queryString && consumedInitialRef.current !== initialData) {
      consumedInitialRef.current = initialData;
      setImages(initialData.images);
      setTotalPages(initialData.pagination.pages);
      setTotalImages(initialData.pagination.total);
      extractTagsFromImages(initialData.images);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/images?${queryString}`);
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
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // One of the searched tags doesn't exist
        setImages([]);
        setAllImages([]);
        setTotalImages(0);
        setTotalPages(1);
      } else {
        console.error('Error fetching images:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const extractTagsFromImages = (pageImages: Image[]) => {
    for (const image of pageImages) {
      for (const tag of image.tags || []) {
        const t = tag as any;
        if (t && typeof t === 'object' && t.name) tagTypes.current.set(t.name, t.type || 'general');
      }
    }
    setTagsByType(organizeTags(pageImages));
  };

  const fetchTagSuggestions = async () => {
    try {
      const response = await axios.get('/api/tags', { params: { suggest: tagInput.trim().replace(/^-/, ''), limit: 20 } });
      if (response.data.success) {
        setTagSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const updateUrl = useCallback((newTags?: string[], newSort?: string, newPage?: number, newUploader?: string) => {
    const params = new URLSearchParams();
    
    const tagsToUse = newTags !== undefined ? newTags : selectedTags.map(t => t.name);
    const sortToUse = newSort || sort;
    const pageToUse = newPage || 1;
    const uploaderToUse = newUploader !== undefined ? newUploader : uploaderParam;
    
    if (pageToUse > 1) params.set('page', pageToUse.toString());
    if (sortToUse !== 'newest') params.set('sort', sortToUse);
    if (tagsToUse.length > 0) params.set('tags', tagsToUse.join(','));
    if (uploaderToUse) params.set('uploader', uploaderToUse);
    
    const queryString = params.toString();
    router.push(`/posts${queryString ? '?' + queryString : ''}`);
  }, [selectedTags, sort, uploaderParam, router]);

  const addTag = useCallback((tag: Tag) => {
    if (!selectedTags.some(t => t.name === tag.name)) {
      const newTags = [...selectedTags.map(t => t.name), tag.name];
      updateUrl(newTags, sort, 1);
    }
    setTagInput('');
    setShowSuggestions(false);
  }, [selectedTags, sort, updateUrl]);

  const removeTag = useCallback((tagName: string) => {
    const newTags = selectedTags.filter(t => t.name !== tagName).map(t => t.name);
    updateUrl(newTags, sort, 1);
  }, [selectedTags, sort, updateUrl]);

  const clearFilters = useCallback(() => {
    router.push('/posts');
  }, [router]);

  /** Hide posts with this tag ("-tag"); drops it from the included tags if it was there. */
  const excludeTag = useCallback((tagName: string) => {
    const bare = normalizeTagName(tagName.replace(/^-/, ''));
    const names = selectedTags.map(t => t.name).filter(n => n !== bare && n !== `-${bare}`);
    updateUrl([...names, `-${bare}`], sort, 1);
  }, [selectedTags, sort, updateUrl]);

  /** Add from the search box: "-" in front excludes. */
  const addSearchTag = useCallback((tag: Tag) => {
    tagTypes.current.set(tag.name, tag.type);
    const excluded = tagInput.trim().startsWith('-');
    const name = excluded ? `-${tag.name}` : tag.name;
    const names = selectedTags.map(t => t.name).filter(n => n !== tag.name && n !== `-${tag.name}`);
    updateUrl([...names, name], sort, 1);
    setTagInput('');
    setShowSuggestions(false);
  }, [selectedTags, sort, updateUrl, tagInput]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && tagInput === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].name);
      return;
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const words = tagInput.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    // One word: take the exact or best autocomplete match; several words: each is a tag
    if (words.length === 1 && tagSuggestions.length > 0) {
      const bare = normalizeTagName(words[0].replace(/^-/, ''));
      addSearchTag(tagSuggestions.find(t => t.name === bare) ?? tagSuggestions[0]);
      return;
    }
    const names = selectedTags.map(t => t.name);
    for (const word of words) {
      const name = word.startsWith('-') ? `-${normalizeTagName(word.slice(1))}` : normalizeTagName(word);
      if (name !== '-' && !names.includes(name)) names.push(name);
    }
    updateUrl(names, sort, 1);
    setTagInput('');
    setShowSuggestions(false);
  };

  const toggleTag = useCallback((tag: Tag | { name: string; type: TagType }) => {
    const newTags = selectedTags.map(t => t.name);
    const exists = newTags.includes(tag.name);
    if (exists) {
      updateUrl(newTags.filter(name => name !== tag.name), sort, 1);
    } else {
      updateUrl([...newTags, tag.name], sort, 1);
    }
  }, [selectedTags, sort, updateUrl]);

  const toggleRating = useCallback((rating: Rating) => {
    const newRatings = toggleRatingUtil(selectedRatings, rating);
    setSelectedRatings(newRatings);
    setRatingsCookie(newRatings);
    if (urlPage > 1) updateUrl(undefined, undefined, 1);
  }, [selectedRatings, urlPage, updateUrl]);

  const typeColors: Record<TagType, string> = {
    artist: 'text-red-400',
    copyright: 'text-purple-400',
    character: 'text-green-400',
    general: 'text-blue-400',
    meta: 'text-yellow-400',
  };

  const chipColors: Record<TagType, string> = {
    artist: 'border-red-500/30 bg-red-500/10 text-red-300',
    copyright: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    character: 'border-green-500/30 bg-green-500/10 text-green-300',
    general: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    meta: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  };

  const includedTags = selectedTags.filter((t) => !t.name.startsWith('-'));

  /** Same URL updateUrl() would push, as a crawlable link */
  const pageHref = (n: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (n > 1) params.set('page', String(n)); else params.delete('page');
    const qs = params.toString();
    return `/posts${qs ? `?${qs}` : ''}`;
  };

  const renderSort = (triggerClassName: string) => (
    <Select value={sort} onValueChange={(value) => updateUrl(undefined, value, 1)}>
      <SelectTrigger className={triggerClassName} aria-label="Sort posts">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest First</SelectItem>
        <SelectItem value="oldest">Oldest First</SelectItem>
        <SelectItem value="popular">Popular</SelectItem>
        <SelectItem value="favorites">Most Favorited</SelectItem>
        <SelectItem value="views">Most Viewed</SelectItem>
        <SelectItem value="alphabetical">Artist A-Z</SelectItem>
        <SelectItem value="random">Random</SelectItem>
      </SelectContent>
    </Select>
  );
  // Shown on the collapsed rail so hidden filters are never forgotten
  const activeFilterCount = selectedTags.length + (uploaderParam ? 1 : 0) + (hideAI ? 1 : 0);

  const SidebarContent = useMemo(() => (
    <div className="space-y-6">
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
        </div>
      </div>

      <Separator />

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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          AI Content
        </h3>
        <button
          onClick={() => { setHideAI(!hideAI); if (urlPage > 1) updateUrl(undefined, undefined, 1); }}
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
      </div>

      <Separator />

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
                    <div key={tag.name} className="group flex items-center gap-1">
                      <a
                        href={`/posts?tags=${encodeURIComponent(tag.name)}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab etc.
                          e.preventDefault();
                          toggleTag(tag);
                        }}
                        title={isSelected ? `Remove ${tag.name}` : `Search ${tag.name}`}
                        className={cn(
                          "flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-md text-sm transition-all flex items-center justify-between",
                          isSelected
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <span className="truncate">{tag.name}</span>
                        <span className="text-xs tabular-nums ml-2 opacity-50">{tag.count.toLocaleString()}</span>
                      </a>
                      <button
                        onClick={() => excludeTag(tag.name)}
                        title={`Hide posts tagged ${tag.name}`}
                        aria-label={`Exclude ${tag.name}`}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-400 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ), [selectedRatings, hideAI, selectedTags, tagsByType, blacklistEnabled, blacklistedTags, uploaderParam, urlPage, toggleTag, toggleRating, updateUrl, excludeTag]);

  const hiddenByBlacklist = useMemo(() => {
    if (!blacklistEnabled || blacklistedTags.length === 0) return 0;
    const sourceImages = infiniteScroll && allImages.length > 0 ? allImages : images;
    return sourceImages.filter(image => shouldHideImage(image.tags as unknown as (string | { name: string })[])).length;
  }, [images, allImages, infiniteScroll, blacklistEnabled, blacklistedTags]);

  const filteredImages = useMemo(() => {
    const sourceImages = infiniteScroll && allImages.length > 0 ? allImages : images;
    if (!blacklistEnabled || blacklistedTags.length === 0) {
      return sourceImages;
    }
    return sourceImages.filter(image => !shouldHideImage(image.tags as unknown as (string | { name: string })[]));
  }, [images, allImages, infiniteScroll, blacklistEnabled, blacklistedTags]);

  return (
    <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-8 max-w-[1800px] mx-auto">
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-[width] duration-200',
          sidebarCollapsed ? 'w-10' : 'w-60 xl:w-64 2xl:w-72'
        )}
      >
        <div className="sticky top-[4.5rem]">
          {sidebarCollapsed ? (
            <button
              onClick={() => toggleSidebar(false)}
              title="Show filters"
              aria-label="Show filters"
              aria-expanded={false}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between pr-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
                <button
                  onClick={() => toggleSidebar(true)}
                  title="Hide filters"
                  aria-label="Hide filters"
                  aria-expanded
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
              <div className="sk-scroll h-[calc(100vh-8.5rem)] overflow-y-auto overflow-x-hidden overscroll-contain pr-3">
                {SidebarContent}
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-1 line-clamp-2 break-words text-2xl font-bold tracking-tight sm:line-clamp-1 sm:text-3xl">
              {includedTags.length > 0 ? includedTags.map((t) => t.name.replace(/_/g, ' ')).join(' + ') : uploaderParam ? `Posts by ${uploaderParam}` : 'Posts'}
            </h1>
            <p className="text-muted-foreground">
              {loading
                ? 'Searching…'
                : `${totalImages.toLocaleString()} ${totalImages === 1 ? 'post' : 'posts'}${selectedTags.length > 0 ? ' match your search' : ''}`}
            </p>
          </div>
          {artistTagInfo && (
            <Link href={`/artist/${encodeURIComponent(artistTagInfo.name.replace(/ /g, '_'))}`}>
              <Button className="bg-red-600 hover:bg-red-700 gap-2">
                <Palette className="h-4 w-4" />
                View {artistTagInfo.name.replace(/_/g, ' ')}&apos;s Artist Page
              </Button>
            </Link>
          )}
        </div>

        {/* Sticky from tablets up; on phones it would cover a third of the screen, so it scrolls away */}
        <div className="relative z-40 -mx-4 mb-6 border-b border-border/40 bg-background/95 px-4 py-3 sm:sticky sm:top-16 sm:backdrop-blur-xl">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="left" className="w-80 max-w-[85vw]">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="sk-scroll mt-6 h-[calc(100vh-100px)] overflow-y-auto overflow-x-hidden overscroll-contain pr-3">
                {SidebarContent}
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-start gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-10 shrink-0 gap-2 sm:inline-flex lg:hidden"
              aria-label="Filters"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>

            {/* Search: the active tags are chips inside the box */}
            <div className="relative min-w-0 flex-1">
              <div
                className="flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1.5 transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20"
                onClick={() => inputRef.current?.focus()}
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                {selectedTags.map((tag) => {
                  const excluded = tag.name.startsWith('-');
                  const bare = excluded ? tag.name.slice(1) : tag.name;
                  const type = tagTypes.current.get(bare) || 'general';
                  return (
                    <span
                      key={tag.name}
                      className={cn(
                        'inline-flex max-w-full items-center gap-1 rounded-lg border py-0.5 pl-2 pr-1 text-xs font-semibold',
                        excluded ? 'border-rose-500/30 bg-rose-500/10 text-rose-300 line-through decoration-rose-400/60' : chipColors[type]
                      )}
                    >
                      {excluded && <Minus className="h-3 w-3 shrink-0 no-underline" />}
                      <span className="truncate">{bare}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTag(tag.name); }}
                        aria-label={`Remove ${bare}`}
                        className="rounded p-0.5 hover:bg-white/10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <input
                  ref={inputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => tagSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={selectedTags.length ? 'Add a tag…' : 'Search tags, e.g. 1girl -comic'}
                  aria-label="Search tags"
                  className="h-7 min-w-[9rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
              </div>

              {showSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute z-[110] mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl">
                  <div className="sk-scroll max-h-72 overflow-y-auto overflow-x-hidden">
                    <div className="p-1">
                      {tagSuggestions.map((tag, i) => (
                        <button
                          key={tag.name}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addSearchTag(tag)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                            i === 0 && 'bg-accent/50'
                          )}
                        >
                          <span className="truncate font-medium">{tagInput.trim().startsWith('-') && <span className="text-rose-400">−</span>}{tag.name}</span>
                          <span className="ml-3 flex shrink-0 items-center gap-2">
                            <span className={cn('text-xs font-medium', typeColors[tag.type || 'general'])}>{tag.type || 'general'}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{tag.count.toLocaleString()}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {renderSort('hidden h-10 w-[170px] shrink-0 sm:flex')}
          </div>

          {/* Phones: the search box gets the whole row; filters and sort sit under it */}
          <div className="mt-2 flex items-center gap-2 sm:hidden">
            <Button variant="outline" size="sm" className="h-9 flex-1 gap-2" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-bold leading-4 text-white">{activeFilterCount}</span>
              )}
            </Button>
            {renderSort('h-9 flex-1')}
          </div>

          {/* Everything else that narrows the results, at a glance */}
          <div className="scrollbar-hide -mx-4 mt-2.5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-4 text-xs [&>*]:shrink-0 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {([
              { rating: 'safe' as Rating, label: 'Safe', on: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
              { rating: 'questionable' as Rating, label: 'Questionable', on: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
              { rating: 'explicit' as Rating, label: 'Explicit', on: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
            ]).map(({ rating, label, on }) => {
              const active = selectedRatings.includes(rating);
              return (
                <button
                  key={rating}
                  onClick={() => toggleRating(rating)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-semibold transition-colors',
                    active ? on : 'border-border/50 text-muted-foreground line-through hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => { setHideAI(!hideAI); if (urlPage > 1) updateUrl(undefined, undefined, 1); }}
              aria-pressed={hideAI}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors',
                hideAI ? 'border-purple-500/40 bg-purple-500/10 text-purple-300' : 'border-border/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <Bot className="h-3 w-3" />
              {hideAI ? 'AI hidden' : 'AI shown'}
            </button>
            {uploaderParam && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 py-1 pl-2.5 pr-1 font-semibold text-sky-300">
                <User className="h-3 w-3" /> by {uploaderParam}
                <button onClick={() => updateUrl(undefined, undefined, 1, '')} aria-label="Remove uploader filter" className="rounded-full p-0.5 hover:bg-white/10">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {blacklistEnabled && hiddenByBlacklist > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 px-2.5 py-1 font-semibold text-amber-300/90" title="Posts on this page hidden by your tag blacklist">
                <EyeOff className="h-3 w-3" /> {hiddenByBlacklist} hidden by blacklist
              </span>
            )}
            {(selectedTags.length > 0 || uploaderParam) && (
              <button onClick={clearFilters} className="ml-1 font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No images found</p>
          </div>
        ) : (
          <>
            <div className={`grid ${gridSizeClasses[gridSize]} gap-3 sm:gap-4 mb-8`}>
              {(() => {
                // Spread 6 ads evenly, then stagger each by a different column offset
                // so they don't all align to the same grid column.
                const adCount = 6;
                const step = Math.max(4, Math.floor(postsPerPage / adCount));
                // Offsets 0..3 stagger each ad so it differs in column position
                const staggerOffsets = [0, 2, 1, 3, 0, 2];
                const adIndices = new Set(
                  Array.from({ length: adCount }, (_, i) => {
                    const base = (i + 1) * step;
                    return base - 1 + staggerOffsets[i % staggerOffsets.length];
                  })
                );
                const adRating = selectedRatings.length === 1 && selectedRatings[0] === 'safe' ? 'safe' : 'explicit';
                let adNum = 0;

                return filteredImages.map((image, index) => (
                  <Fragment key={(image.id || image._id)?.toString()}>
                    {adIndices.has(index) && (
                      <NativeAd
                        key={`ad-${image.id || image._id}`}
                        id={`inline-${adNum++}`}
                        rating={adRating}
                      />
                    )}
                    <ImageCard image={image} priority={index < 8} preload={index < 2} />
                  </Fragment>
                ));
              })()}

            </div>


            {infiniteScroll ? (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
            ) : (
              totalPages > 1 && (
                <div className="flex justify-center items-center gap-4">
                  {urlPage > 1 ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(urlPage - 1)} rel="prev">Previous</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>Previous</Button>
                  )}
                  <span className="text-sm">Page {urlPage} of {totalPages}</span>
                  {urlPage < totalPages ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(urlPage + 1)} rel="next">Next</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>Next</Button>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// No Suspense boundary here: /posts is always rendered per request, so
// useSearchParams never bails out, and a boundary only made the browser paint
// a full-screen spinner first and swap the grid in later (a slow LCP).
export default function PostsPage(props: PostsPageProps) {
  return <PostsPageContent {...props} />;
}
