'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Tag as TagIcon, Sparkles, Shield, AlertTriangle, Ban, Wand2, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Tag as TagModel } from '@/lib/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { normalizeTagName } from '@/lib/tagName';
import { detectAiProvenance, type AiProvenance } from '@/lib/aiProvenance';

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';
type TagData = { name: string; type: TagType };
type Rating = 'safe' | 'questionable' | 'explicit';
type SuggestedTag = TagData & { score: number; recommended: boolean; isNew: boolean };

const RATING_ORDER: Rating[] = ['safe', 'questionable', 'explicit'];
// Keep in sync with MIN_TAGS in lib/autotagApply.ts (the server enforces it)
const MIN_TAGS = 5;

/** Re-encode an image as a ≤768px JPEG on a white background, or null if the browser can't decode it. */
async function shrinkForTagging(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9));
  } catch {
    return null;
  }
}

const suggestionColors: Record<TagType, string> = {
  artist: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
  copyright: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10',
  character: 'border-green-500/30 text-green-400 hover:bg-green-500/10',
  general: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
  meta: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10',
};

export default function UploadForm() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<TagData[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagModel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rating, setRating] = useState<Rating>('safe');
  // A ref, not state: suggestions arrive asynchronously and must see the latest value
  const ratingTouchedRef = useRef(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  // Set when the file itself says it was AI-made; locks the checkbox on
  const [aiProvenance, setAiProvenance] = useState<AiProvenance | null>(null);
  const provenanceCheckRef = useRef(0);
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Autotagger suggestions
  const [autotagEnabled, setAutotagEnabled] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [suggestedRating, setSuggestedRating] = useState<{ value: Rating; score: number } | null>(null);
  const [suggestError, setSuggestError] = useState('');
  const suggestRequestRef = useRef(0);

  useEffect(() => {
    axios.get('/api/autotag')
      .then((res) => setAutotagEnabled(Boolean(res.data?.enabled)))
      .catch(() => setAutotagEnabled(false));
  }, []);

  const clearSuggestions = () => {
    suggestRequestRef.current++;
    setSuggesting(false);
    setSuggestedTags([]);
    setSuggestedRating(null);
    setSuggestError('');
  };

  const requestSuggestions = async (image: File) => {
    const requestId = ++suggestRequestRef.current;
    setSuggesting(true);
    setSuggestError('');
    setSuggestedTags([]);
    setSuggestedRating(null);
    try {
      const formData = new FormData();
      // Send a small copy decoded by the browser: much less to upload, and it
      // works for any format the browser can show even if the server can't decode it.
      formData.append('file', (await shrinkForTagging(image)) ?? image);
      const response = await axios.post('/api/autotag', formData);
      if (requestId !== suggestRequestRef.current || !response.data.success) return;
      setSuggestedTags(response.data.tags || []);
      const predicted: { value: Rating; score: number } | null = response.data.rating;
      setSuggestedRating(predicted);
      // Only ever raise the rating on its own, and never override a manual pick
      if (predicted && !ratingTouchedRef.current) {
        setRating((current) =>
          RATING_ORDER.indexOf(predicted.value) > RATING_ORDER.indexOf(current) ? predicted.value : current
        );
      }
    } catch (err: any) {
      if (requestId !== suggestRequestRef.current) return;
      setSuggestError(err.response?.data?.error || 'Tag suggestions are unavailable right now');
    } finally {
      if (requestId === suggestRequestRef.current) setSuggesting(false);
    }
  };

  const addSuggestedTag = (tag: SuggestedTag) => {
    setTags((prev) => (prev.some((t) => t.name === tag.name) ? prev : [...prev, { name: tag.name, type: tag.type }]));
  };

  const pendingSuggestions = suggestedTags.filter((s) => !tags.some((t) => t.name === s.name));
  const pendingRecommended = pendingSuggestions.filter((s) => s.recommended);

  const addAllRecommended = () => {
    setTags((prev) => [
      ...prev,
      ...pendingRecommended
        .filter((s) => !prev.some((t) => t.name === s.name))
        .map((s) => ({ name: s.name, type: s.type })),
    ]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Read the original bytes (metadata intact) for AI provenance
      setAiProvenance(null);
      const check = ++provenanceCheckRef.current;
      selectedFile.arrayBuffer().then((buf) => {
        if (check !== provenanceCheckRef.current) return; // another file was picked meanwhile
        const found = detectAiProvenance(new Uint8Array(buf));
        setAiProvenance(found);
        if (found) setIsAIGenerated(true);
      }).catch(() => {});
      if (autotagEnabled) {
        requestSuggestions(selectedFile);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  useEffect(() => {
    if (tagInput.trim().length === 0) {
      setTagSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Debounce so we don't fire a request on every keystroke.
    const t = setTimeout(() => fetchTagSuggestions(), 200);
    return () => clearTimeout(t);
  }, [tagInput]);

  const fetchTagSuggestions = async () => {
    try {
      const response = await axios.get('/api/tags', { params: { suggest: tagInput.trim(), limit: 10 } });
      if (response.data.success) {
        setTagSuggestions(response.data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const addTag = (tag: TagModel) => {
    if (!tags.some(t => t.name === tag.name)) {
      setTags([...tags, { name: tag.name, type: tag.type }]);
    }
    setTagInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const addManualTag = () => {
    const newTag = normalizeTagName(tagInput);
    if (newTag && !tags.some(t => t.name === newTag)) {
      setTags([...tags, { name: newTag, type: 'general' }]);
      setTagInput('');
    }
  };

  const handleTagAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const normalizedInput = normalizeTagName(tagInput);
      const hasSuggestions = tagSuggestions.length > 0 && showSuggestions;
      const topSuggestion = hasSuggestions ? tagSuggestions[0] : null;

      // Only accept the top suggestion on Enter if it exactly matches the input
      if (topSuggestion && topSuggestion.name.toLowerCase() === normalizedInput) {
        addTag(topSuggestion);

        // Check for complementary tags
        const complementaryTags = await fetchComplementaryTags(topSuggestion.name);
        if (complementaryTags.length > 0) {
          const complementary = complementaryTags[0];
          if (!tags.some(t => t.name === complementary.name)) {
            setTags(prev => [...prev, { name: complementary.name, type: complementary.type }]);
          }
        }
      } else {
        addManualTag();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const fetchComplementaryTags = async (tagName: string): Promise<TagModel[]> => {
    try {
      const response = await axios.post('/api/tags/complementary', { tag: tagName });
      if (response.data.success) {
        return response.data.suggestions;
      }
    } catch (error) {
      console.error('Error fetching complementary tags:', error);
    }
    return [];
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag.name !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select an image');
      return;
    }

    if (tags.length < MIN_TAGS) {
      setError(`Please add at least ${MIN_TAGS} tags (${tags.length} so far)`);
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tags', JSON.stringify(tags));
      formData.append('rating', rating);
      formData.append('isAIGenerated', isAIGenerated.toString());
      formData.append('postAnonymously', postAnonymously.toString());
      if (source) formData.append('source', source);
      if (description) formData.append('description', description);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        router.push(`/image/${response.data.image.sequentialId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground">Upload Content</h1>
          <p className="text-muted-foreground font-medium">
            {!user ? (
              <span className="text-amber-500">
                Uploading anonymously - images will be attributed to "Anonymous"
              </span>
            ) : (
              'Share your artwork with the community'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Preview */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl">
              <CardContent className="p-0">
                {!preview ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video flex flex-col items-center justify-center border-2 border-dashed border-border/50 m-4 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-lg font-bold text-foreground">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground font-medium mt-1">PNG, JPG, WEBP or GIF (max. 20MB)</p>
                  </div>
                ) : (
                  <div className="relative aspect-auto min-h-[300px] bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-full object-contain max-h-[600px]" 
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-4 right-4 rounded-xl shadow-lg"
                      onClick={() => {
                        setFile(null);
                        setAiProvenance(null);
                        provenanceCheckRef.current++;
                        setPreview(null);
                        clearSuggestions();
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
              </CardContent>
            </Card>

            {/* Description & Source */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source URL</Label>
                  <Input
                    id="source"
                    placeholder="https://pixiv.net/artworks/..."
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="h-12 bg-background/50 border-border/50 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell us more about this piece..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[120px] bg-background/50 border-border/50 rounded-xl resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Tags & Settings */}
          <div className="lg:col-span-5 space-y-6">
            {/* Tags Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold">Tags</CardTitle>
                  <span className={cn(
                    'text-xs font-bold tabular-nums rounded-lg px-2 py-0.5 border',
                    tags.length >= MIN_TAGS
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  )}>
                    {tags.length}/{MIN_TAGS} minimum
                  </span>
                </div>
                <CardDescription className="font-medium">
                  At least {MIN_TAGS} tags: artist, series, characters and what you see.{' '}
                  <a href="/guidelines/tagging" target="_blank" className="underline hover:text-foreground">Tagging guidelines</a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <div className="relative">
                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      placeholder="Add tags (press Enter)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagAdd}
                      className="pl-10 h-12 bg-background/50 border-border/50 rounded-xl"
                    />
                  </div>
                  
                  {showSuggestions && tagSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                      {tagSuggestions.map((suggestion) => {
                        const typeColors = {
                          artist: 'text-red-400',
                          copyright: 'text-purple-400',
                          character: 'text-green-400',
                          general: 'text-blue-400',
                          meta: 'text-yellow-400',
                        };
                        return (
                          <button
                            key={suggestion.name}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-primary/10 flex items-center justify-between group transition-colors"
                            onClick={() => addTag(suggestion)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn("w-2 h-2 rounded-full", typeColors[suggestion.type])} />
                              <span className="font-bold text-sm">{suggestion.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground font-medium group-hover:text-primary">{suggestion.count} posts</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-xl bg-background/30 border border-border/30">
                  {tags.length === 0 && (
                    <span className="text-sm text-muted-foreground font-medium italic">No tags added yet</span>
                  )}
                  {tags.map((tag) => {
                    const typeColors = {
                      artist: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
                      copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
                      character: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
                      general: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
                      meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
                    };
                    return (
                      <Badge
                        key={tag.name}
                        variant="secondary"
                        className={cn(
                          "pl-2 pr-1 py-1 rounded-lg font-bold text-xs uppercase tracking-wider border-transparent",
                          typeColors[tag.type]
                        )}
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => removeTag(tag.name)}
                          className="ml-1.5 hover:bg-black/10 rounded-md p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>

                {autotagEnabled && (suggesting || suggestError || pendingSuggestions.length > 0) && (
                  <div className="space-y-2.5 rounded-xl border border-border/30 bg-background/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Wand2 className="h-3.5 w-3.5" />
                        Suggested tags
                      </p>
                      {pendingRecommended.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={addAllRecommended}>
                          Add {pendingRecommended.length} suggested
                        </Button>
                      )}
                    </div>
                    {suggesting && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Looking at your image…
                      </p>
                    )}
                    {suggestError && !suggesting && (
                      <p className="text-xs text-muted-foreground font-medium">{suggestError}</p>
                    )}
                    {pendingSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pendingSuggestions.slice(0, 40).map((tag) => (
                          <button
                            key={tag.name}
                            type="button"
                            onClick={() => addSuggestedTag(tag)}
                            title={`${Math.round(tag.score * 100)}% confidence${tag.isNew ? ' · new tag' : ''}`}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors',
                              suggestionColors[tag.type] || suggestionColors.general,
                              !tag.recommended && 'border-dashed opacity-60 hover:opacity-100'
                            )}
                          >
                            <Plus className="h-3 w-3" />
                            {tag.name}
                            <span className="tabular-nums font-medium opacity-60">{Math.round(tag.score * 100)}%</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rating */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Content Rating</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['safe', 'questionable', 'explicit'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setRating(r); ratingTouchedRef.current = true; }}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all",
                          rating === r 
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                            : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {suggestedRating && (
                    <p className="text-xs text-muted-foreground font-medium">
                      Suggested: <span className="font-bold uppercase tracking-wider">{suggestedRating.value}</span>{' '}
                      ({Math.round(suggestedRating.score * 100)}%)
                      {rating !== suggestedRating.value && (
                        <button
                          type="button"
                          className="ml-2 underline hover:text-foreground"
                          onClick={() => { setRating(suggestedRating.value); ratingTouchedRef.current = true; }}
                        >
                          Use this
                        </button>
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className={cn(
                    "flex items-center justify-between gap-3 p-4 rounded-xl border",
                    aiProvenance ? "bg-purple-500/5 border-purple-500/30" : "bg-background/50 border-border/50"
                  )}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold">AI Generated</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {aiProvenance
                            ? `${aiProvenance.evidence} in this file show it was made with ${aiProvenance.source}, so it's marked as AI-generated.`
                            : 'Mark if created by AI'}
                        </p>
                      </div>
                    </div>
                    <Checkbox
                      id="ai"
                      checked={isAIGenerated}
                      onCheckedChange={(checked) => { if (!aiProvenance) setIsAIGenerated(checked as boolean); }}
                      disabled={!!aiProvenance}
                      className="h-5 w-5 shrink-0 rounded-md"
                    />
                  </div>

                  {user && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center">
                          <Shield className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Post Anonymously</p>
                          <p className="text-xs text-muted-foreground font-medium">Hide your username</p>
                        </div>
                      </div>
                      <Checkbox
                        id="anonymous"
                        checked={postAnonymously}
                        onCheckedChange={(checked) => setPostAnonymously(checked as boolean)}
                        className="h-5 w-5 rounded-md"
                      />
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-bold">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full h-14 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white animate-spin rounded-full mr-3" />
                      Uploading...
                    </>
                  ) : (
                    'Publish Post'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
