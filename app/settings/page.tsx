'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Tag, X, Plus, Shield, Eye, EyeOff, Trash2, Search, ExternalLink, Moon, Sun, Monitor, Grid3X3, LayoutGrid, Palette, Bell, BellOff, ImageIcon, Sparkles, Ban, AlertTriangle, Download, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBlacklistedTags,
  addBlacklistedTag,
  removeBlacklistedTag,
  isBlacklistEnabled,
  setBlacklistEnabled,
} from '@/lib/blacklist';
import { getRatingsFromCookie, setRatingsCookie, Rating } from '@/lib/ratingPreferences';
import axios from 'axios';
import { Tag as TagModel } from '@/lib/models';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Blacklist
  const [blacklistedTags, setBlacklistedTags] = useState<string[]>([]);
  const [blacklistEnabled, setBlacklistEnabledState] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagModel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Display Settings
  const [gridSize, setGridSize] = useState('medium');
  const [defaultRatings, setDefaultRatings] = useState<Rating[]>(['safe']);
  const [hideAIDefault, setHideAIDefault] = useState(false);
  const [autoplayGifs, setAutoplayGifs] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const [postsPerPage, setPostsPerPage] = useState('24');
  
  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  const [favoriteNotifications, setFavoriteNotifications] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    setBlacklistedTags(getBlacklistedTags());
    setBlacklistEnabledState(isBlacklistEnabled());
    setDefaultRatings(getRatingsFromCookie());
    
    // Load other settings
    const savedGridSize = localStorage.getItem('serika_grid_size');
    if (savedGridSize) setGridSize(savedGridSize);
    
    const savedHideAI = localStorage.getItem('serika_hide_ai_default');
    if (savedHideAI) setHideAIDefault(savedHideAI === 'true');
    
    const savedAutoplay = localStorage.getItem('serika_autoplay_gifs');
    if (savedAutoplay !== null) setAutoplayGifs(savedAutoplay === 'true');
    
    const savedThumbnails = localStorage.getItem('serika_show_thumbnails');
    if (savedThumbnails !== null) setShowThumbnails(savedThumbnails === 'true');
    
    const savedInfinite = localStorage.getItem('serika_infinite_scroll');
    if (savedInfinite) setInfiniteScroll(savedInfinite === 'true');
    
    const savedPostsPerPage = localStorage.getItem('serika_posts_per_page');
    if (savedPostsPerPage) setPostsPerPage(savedPostsPerPage);
  }, []);

  useEffect(() => {
    if (tagInput.trim().length > 0) {
      fetchTagSuggestions();
    } else {
      setTagSuggestions([]);
      setShowSuggestions(false);
    }
  }, [tagInput]);

  const fetchTagSuggestions = async () => {
    try {
      const response = await axios.post('/api/tags', { 
        query: tagInput.trim(), 
        limit: 8 
      });
      if (response.data.success) {
        setTagSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleAddTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim();
    if (normalized && !blacklistedTags.includes(normalized)) {
      addBlacklistedTag(normalized);
      setBlacklistedTags([...blacklistedTags, normalized]);
    }
    setTagInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tag: string) => {
    removeBlacklistedTag(tag);
    setBlacklistedTags(blacklistedTags.filter(t => t !== tag));
  };

  const handleToggleBlacklist = (enabled: boolean) => {
    setBlacklistEnabled(enabled);
    setBlacklistEnabledState(enabled);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagSuggestions.length > 0 && showSuggestions) {
        handleAddTag(tagSuggestions[0].name);
      } else if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clearAllTags = () => {
    blacklistedTags.forEach(tag => removeBlacklistedTag(tag));
    setBlacklistedTags([]);
  };
  
  const handleGridSizeChange = (value: string) => {
    setGridSize(value);
    localStorage.setItem('serika_grid_size', value);
  };
  
  const handleRatingToggle = (rating: Rating) => {
    let newRatings: Rating[];
    if (defaultRatings.includes(rating)) {
      newRatings = defaultRatings.filter(r => r !== rating);
      if (newRatings.length === 0) newRatings = ['safe'];
    } else {
      newRatings = [...defaultRatings, rating];
    }
    setDefaultRatings(newRatings);
    setRatingsCookie(newRatings);
  };
  
  const handleHideAIChange = (value: boolean) => {
    setHideAIDefault(value);
    localStorage.setItem('serika_hide_ai_default', value.toString());
  };
  
  const handleAutoplayChange = (value: boolean) => {
    setAutoplayGifs(value);
    localStorage.setItem('serika_autoplay_gifs', value.toString());
  };
  
  const handleThumbnailsChange = (value: boolean) => {
    setShowThumbnails(value);
    localStorage.setItem('serika_show_thumbnails', value.toString());
  };
  
  const handleInfiniteScrollChange = (value: boolean) => {
    setInfiniteScroll(value);
    localStorage.setItem('serika_infinite_scroll', value.toString());
  };
  
  const handlePostsPerPageChange = (value: string) => {
    setPostsPerPage(value);
    localStorage.setItem('serika_posts_per_page', value);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground font-medium">
            Customize your browsing experience
          </p>
        </div>

        <div className="space-y-8">{/* Account Info */}
          {user && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Account
                </CardTitle>
                <CardDescription>
                  Logged in as <span className="font-bold text-foreground">{user.username}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50">
                  <div>
                    <p className="text-sm font-bold">Serika Account Settings</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Manage your profile, password, and linked services
                    </p>
                  </div>
                  <Button variant="outline" asChild className="rounded-xl">
                    <a href={`${ACCOUNTS_URL}/account`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Display Settings */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" />
                Display
              </CardTitle>
              <CardDescription>
                Customize how content is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grid Size */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Grid Size</Label>
                  <p className="text-xs text-muted-foreground">Number of columns in image grid</p>
                </div>
                <Select value={gridSize} onValueChange={handleGridSizeChange}>
                  <SelectTrigger className="w-32 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (6)</SelectItem>
                    <SelectItem value="medium">Medium (4)</SelectItem>
                    <SelectItem value="large">Large (3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* Posts Per Page */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Posts Per Page</Label>
                  <p className="text-xs text-muted-foreground">Number of images to load at once</p>
                </div>
                <Select value={postsPerPage} onValueChange={handlePostsPerPageChange}>
                  <SelectTrigger className="w-32 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="24">24</SelectItem>
                    <SelectItem value="48">48</SelectItem>
                    <SelectItem value="96">96</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* Infinite Scroll */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Infinite Scroll</Label>
                  <p className="text-xs text-muted-foreground">Automatically load more posts when scrolling</p>
                </div>
                <Switch checked={infiniteScroll} onCheckedChange={handleInfiniteScrollChange} />
              </div>
              
              <Separator />
              
              {/* Thumbnails */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Use Thumbnails</Label>
                  <p className="text-xs text-muted-foreground">Show compressed thumbnails for faster loading</p>
                </div>
                <Switch checked={showThumbnails} onCheckedChange={handleThumbnailsChange} />
              </div>
              
              <Separator />
              
              {/* Autoplay GIFs */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold">Autoplay GIFs</Label>
                  <p className="text-xs text-muted-foreground">Automatically play animated images</p>
                </div>
                <Switch checked={autoplayGifs} onCheckedChange={handleAutoplayChange} />
              </div>
            </CardContent>
          </Card>

          {/* Content Preferences */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Content Preferences
              </CardTitle>
              <CardDescription>
                Set your default content filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Ratings */}
              <div>
                <Label className="text-sm font-bold mb-3 block">Default Content Ratings</Label>
                <p className="text-xs text-muted-foreground mb-4">Select which ratings to show by default</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRatingToggle('safe')}
                    className={cn(
                      "rounded-xl gap-2",
                      defaultRatings.includes('safe') && "bg-green-500/10 border-green-500/50 text-green-400"
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    Safe
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRatingToggle('questionable')}
                    className={cn(
                      "rounded-xl gap-2",
                      defaultRatings.includes('questionable') && "bg-yellow-500/10 border-yellow-500/50 text-yellow-400"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Questionable
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRatingToggle('explicit')}
                    className={cn(
                      "rounded-xl gap-2",
                      defaultRatings.includes('explicit') && "bg-red-500/10 border-red-500/50 text-red-400"
                    )}
                  >
                    <Ban className="h-4 w-4" />
                    Explicit
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              {/* Hide AI by default */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Hide AI-Generated Content
                  </Label>
                  <p className="text-xs text-muted-foreground">Hide AI images by default when browsing</p>
                </div>
                <Switch checked={hideAIDefault} onCheckedChange={handleHideAIChange} />
              </div>
            </CardContent>
          </Card>

          {/* Tag Blacklist */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <EyeOff className="h-5 w-5 text-primary" />
                    Tag Blacklist
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Hide posts containing specific tags from your feed
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="blacklist-toggle" className="text-sm font-bold text-muted-foreground">
                    {blacklistEnabled ? 'Active' : 'Disabled'}
                  </Label>
                  <Switch
                    id="blacklist-toggle"
                    checked={blacklistEnabled}
                    onCheckedChange={handleToggleBlacklist}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Tag Input */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="Search for tags to blacklist..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-11 h-12 bg-background/50 border-border/50 rounded-xl"
                  />
                </div>
                
                {showSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                    {tagSuggestions.map((suggestion) => {
                      const isAlreadyBlacklisted = blacklistedTags.includes(suggestion.name.toLowerCase());
                      return (
                        <button
                          key={suggestion.name}
                          className={cn(
                            "w-full px-4 py-3 text-left flex items-center justify-between group transition-colors",
                            isAlreadyBlacklisted 
                              ? "opacity-50 cursor-not-allowed" 
                              : "hover:bg-primary/10"
                          )}
                          onClick={() => !isAlreadyBlacklisted && handleAddTag(suggestion.name)}
                          disabled={isAlreadyBlacklisted}
                        >
                          <div className="flex items-center gap-3">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-bold text-sm">{suggestion.name}</span>
                            {isAlreadyBlacklisted && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Already added
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-medium group-hover:text-primary">
                            {suggestion.count} posts
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Blacklisted Tags List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Blacklisted Tags ({blacklistedTags.length})
                  </Label>
                  {blacklistedTags.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllTags}
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-7"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className={cn(
                  "min-h-[100px] p-4 rounded-xl border border-border/50 bg-background/30",
                  !blacklistEnabled && "opacity-50"
                )}>
                  {blacklistedTags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                      <Eye className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">No tags blacklisted</p>
                      <p className="text-xs">Search above to add tags</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {blacklistedTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="pl-3 pr-1 py-1.5 rounded-lg font-bold text-sm bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 transition-colors group"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-2 p-0.5 rounded-md hover:bg-destructive/20 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {blacklistEnabled 
                    ? "Posts containing any of these tags will be hidden from your feed."
                    : "Blacklist is currently disabled. Toggle it on to hide posts."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data & Privacy */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Data & Privacy
              </CardTitle>
              <CardDescription>
                Manage your data and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50">
                <div>
                  <p className="text-sm font-bold">Export Your Data</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Download a copy of your favorites and settings
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="rounded-xl"
                  onClick={() => {
                    const data = {
                      blacklistedTags: getBlacklistedTags(),
                      blacklistEnabled: isBlacklistEnabled(),
                      defaultRatings: getRatingsFromCookie(),
                      gridSize: localStorage.getItem('serika_grid_size'),
                      hideAIDefault: localStorage.getItem('serika_hide_ai_default'),
                      autoplayGifs: localStorage.getItem('serika_autoplay_gifs'),
                      showThumbnails: localStorage.getItem('serika_show_thumbnails'),
                      infiniteScroll: localStorage.getItem('serika_infinite_scroll'),
                      postsPerPage: localStorage.getItem('serika_posts_per_page'),
                      exportedAt: new Date().toISOString(),
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `serika-settings-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50">
                <div>
                  <p className="text-sm font-bold">Clear Local Data</p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Reset all local settings and preferences
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm('This will reset all your local settings including blacklist, display preferences, and content filters. Continue?')) {
                      // Clear all serika-related localStorage items
                      const keysToRemove = [
                        'serika_tag_blacklist',
                        'serika_blacklist_enabled', 
                        'serika_grid_size',
                        'serika_hide_ai_default',
                        'serika_autoplay_gifs',
                        'serika_show_thumbnails',
                        'serika_infinite_scroll',
                        'serika_posts_per_page',
                      ];
                      keysToRemove.forEach(key => localStorage.removeItem(key));
                      // Clear rating cookie
                      document.cookie = 'serika_ratings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                      window.location.reload();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-amber-500/20 bg-amber-500/5 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Eye className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">Settings Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    Your preferences are stored locally in your browser. They will persist across sessions 
                    but won't sync to other devices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
