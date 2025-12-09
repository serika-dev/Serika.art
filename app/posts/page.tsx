'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ImageCard from '@/components/ImageCard';
import { Image, Tag } from '@/lib/models';
import axios from 'axios';
import { ChevronLeft, ChevronRight, Loader2, Hash, TrendingUp, X, Search, Shield, AlertTriangle, Ban } from 'lucide-react';
import Link from 'next/link';

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';
type Rating = 'safe' | 'questionable' | 'explicit';

function PostsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Get parameters from URL
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const tagsParam = searchParams.get('tags') || '';
  const ratingsParam = searchParams.get('ratings') || 'safe';
  
  const selectedTags = tagsParam 
    ? tagsParam.split(',').map((tag, idx) => ({ name: tag, type: 'general' as TagType }))
    : [];
  const selectedRatings = (ratingsParam || '').split(',').filter(Boolean) as Rating[];

  useEffect(() => {
    fetchImages();
  }, [page, sort, tagsParam, ratingsParam]);

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
      const tagsQueryParam = tagsParam ? `&tags=${tagsParam}` : '';
      const ratingsQueryParam = `&ratings=${ratingsParam}`;
      const response = await axios.get(`/api/images?page=${page}&limit=24&sort=${sort}${tagsQueryParam}${ratingsQueryParam}`);
      if (response.data.success) {
        setImages(response.data.images);
        setTotalPages(response.data.pagination.pages);
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
    const tagCounts: Record<string, { count: number; type: TagType; _id: string }> = {};
    
    // Collect all tags from current page images
    pageImages.forEach(image => {
      image.tags.forEach(tag => {
        const tagName = typeof tag === 'string' ? tag : (tag && 'name' in tag) ? (tag as any).name : null;
        const tagType = typeof tag === 'object' && 'type' in tag ? (tag as any).type : 'general';
        const tagId = (tag && typeof tag === 'object' && '_id' in tag) ? (tag as any)._id : null;
        
        if (tagName && tagId) {
          if (!tagCounts[tagName]) {
            tagCounts[tagName] = { count: 0, type: tagType || 'general', _id: tagId };
          }
          tagCounts[tagName].count++;
        }
      });
    });

    // Organize by type with minimums
    const organized: Record<TagType, any[]> = {
      general: [],
      artist: [],
      character: [],
      copyright: [],
      meta: [],
    };

    Object.entries(tagCounts).forEach(([name, data]) => {
      organized[data.type].push({
        name,
        type: data.type,
        count: data.count,
        _id: data._id,
      });
    });

    // Sort by count and limit
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

  const updateUrl = (newTags?: string[], newSort?: string, newPage?: number) => {
    const params = new URLSearchParams();
    
    const tagsToUse = newTags !== undefined ? newTags : selectedTags.map(t => t.name);
    const sortToUse = newSort || sort;
    const pageToUse = newPage || 1;
    
    if (pageToUse > 1) params.set('page', pageToUse.toString());
    if (sortToUse !== 'newest') params.set('sort', sortToUse);
    if (tagsToUse.length > 0) params.set('tags', tagsToUse.join(','));
    if (selectedRatings.length < 3) params.set('ratings', selectedRatings.join(','));
    
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
    let newRatings: Rating[];
    if (selectedRatings.includes(rating)) {
      newRatings = selectedRatings.filter(r => r !== rating);
      if (newRatings.length === 0) newRatings = selectedRatings; // Must keep at least one
    } else {
      newRatings = [...selectedRatings, rating];
    }
    
    const params = new URLSearchParams();
    const tagsToUse = selectedTags.map(t => t.name);
    if (page > 1) params.set('page', page.toString());
    if (sort !== 'newest') params.set('sort', sort);
    if (tagsToUse.length > 0) params.set('tags', tagsToUse.join(','));
    if (newRatings.length < 3) params.set('ratings', newRatings.join(','));
    const queryString = params.toString();
    router.push(`/posts${queryString ? '?' + queryString : ''}`);
  };

  return (
    <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-8">
      {/* Sidebar - Tags */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 h-[calc(100vh-120px)] overflow-y-auto pr-2 scrollbar-hide">
          {/* Tag Search */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Search size={16} />
              Search Tags
            </h3>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Type to search..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {tagSuggestions.map((tag) => {
                    const typeColors = {
                      artist: 'text-red-400',
                      copyright: 'text-purple-400',
                      character: 'text-green-400',
                      general: 'text-blue-400',
                      meta: 'text-yellow-400',
                    };
                    return (
                      <button
                        key={tag.name}
                        onClick={() => addTag(tag)}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-700 transition flex items-center justify-between"
                      >
                        <span className="text-sm text-white">{tag.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${typeColors[tag.type || 'general']}`}>
                            {tag.type || 'general'}
                          </span>
                          <span className="text-xs text-zinc-500">{tag.count}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Content Ratings */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield size={16} />
              Content Rating
            </h3>
            <div className="space-y-2">
              {[
                { rating: 'safe' as Rating, icon: Shield, label: 'Safe', color: 'text-green-400' },
                { rating: 'questionable' as Rating, icon: AlertTriangle, label: 'Questionable', color: 'text-yellow-400' },
                { rating: 'explicit' as Rating, icon: Ban, label: 'Explicit', color: 'text-red-400' },
              ].map(({ rating, icon: Icon, label, color }) => (
                <button
                  key={rating}
                  onClick={() => toggleRating(rating)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded transition ${
                    selectedRatings.includes(rating)
                      ? 'bg-zinc-800 border border-zinc-700'
                      : 'bg-zinc-900/50 border border-zinc-800/50 opacity-40'
                  }`}
                >
                  <Icon size={16} className={color} />
                  <span className="text-sm text-zinc-300">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">Active Filters</h3>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <button
                    key={tag.name}
                    onClick={() => removeTag(tag.name)}
                    className="bg-blue-900/50 border border-blue-700 text-blue-200 px-2 py-1 rounded text-xs hover:bg-blue-900 transition flex items-center gap-1"
                  >
                    <span>{tag.name}</span>
                    <X size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags by Type */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 space-y-4">
            {(['artist', 'copyright', 'character', 'general'] as TagType[]).map((type) => {
              const tags = tagsByType[type] || [];
              if (tags.length === 0) return null;
              
              const typeColors = {
                artist: 'text-red-400',
                copyright: 'text-purple-400',
                character: 'text-green-400',
                general: 'text-blue-400',
                meta: 'text-yellow-400',
              };

              return (
                <div key={type}>
                  <h4 className={`text-xs font-semibold uppercase mb-2 ${typeColors[type]}`}>
                    {type}
                  </h4>
                  <div className="space-y-1">
                    {tags.map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => toggleTag(tag)}
                        className={`w-full text-left px-2 py-1 rounded text-sm transition flex items-center justify-between ${
                          selectedTags.some(t => t.name === tag.name)
                            ? 'bg-blue-900/50 text-blue-200'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{tag.name}</span>
                        <span className="text-xs text-zinc-600 ml-2">{tag.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Posts</h1>
          <p className="text-zinc-400">Discover amazing artwork from our community</p>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900 rounded-lg shadow-sm p-4 mb-6 border border-zinc-800">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-300">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => updateUrl(undefined, e.target.value, 1)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="favorites">Most Favorited</option>
                <option value="views">Most Viewed</option>
              </select>
            </label>
            {(selectedTags.length > 0 || selectedRatings.length < 3 || sort !== 'newest') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white transition"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-blue-500" size={48} />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No images found</p>
          </div>
        ) : (
          <>
            {/* Image Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {images.map((image) => (
                <ImageCard key={image._id.toString()} image={image} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => updateUrl(undefined, undefined, Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-zinc-300"
                >
                  <ChevronLeft size={20} />
                  Previous
                </button>
                <span className="text-zinc-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => updateUrl(undefined, undefined, Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-zinc-300"
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen flex items-center justify-center"><Loader2 className="animate-spin" size={40} /></div>}>
      <PostsPageContent />
    </Suspense>
  );
}
