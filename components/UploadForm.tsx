'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Tag, Sparkles, Shield, AlertTriangle, Ban } from 'lucide-react';
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

type TagType = 'general' | 'artist' | 'character' | 'copyright' | 'meta';
type TagData = { name: string; type: TagType };

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
  const [rating, setRating] = useState<'safe' | 'questionable' | 'explicit'>('safe');
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
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

  const fetchTagSuggestions = async () => {
    try {
      const response = await axios.post('/api/tags', { 
        query: tagInput.trim(), 
        limit: 10 
      });
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
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.some(t => t.name === newTag)) {
      setTags([...tags, { name: newTag, type: 'general' }]);
      setTagInput('');
    }
  };

  const handleTagAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const normalizedInput = tagInput.trim().toLowerCase();
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

    if (tags.length === 0) {
      setError('Please add at least one tag');
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
      if (source) formData.append('source', source);
      if (description) formData.append('description', description);

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        router.push(`/image/${response.data.image._id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Image</h1>
        <p className="text-muted-foreground">
          {!user ? (
            <span className="text-yellow-500">
              Uploading anonymously - images will be attributed to "Anonymous"
            </span>
          ) : (
            'Share your artwork with the community'
          )}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/15 border border-destructive/50 text-destructive px-4 py-3 rounded-lg mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* File Upload */}
        <Card className="border-dashed border-2">
          <CardContent className="pt-6">
            {!preview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-12 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
              >
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-1">Click to select an image</p>
                <p className="text-sm text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-black/50 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="max-h-[400px] object-contain" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-4 right-4"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags <span className="text-destructive">*</span></Label>
            <div className="relative">
              <div className="min-h-[42px] p-1.5 rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-all">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const typeColors = {
                      artist: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
                      copyright: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
                      character: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
                      general: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
                      meta: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
                    };
                    const tagType: TagType = (tag.type as TagType) || 'general';
                    return (
                      <Badge
                        key={tag.name}
                        variant="secondary"
                        className={cn("pl-2 pr-1 py-1 gap-1 font-normal", typeColors[tagType])}
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => removeTag(tag.name)}
                          className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    );
                  })}
                  <input
                    ref={inputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagAdd}
                    placeholder={tags.length === 0 ? "Start typing to search tags..." : ""}
                    className="flex-1 bg-transparent outline-none text-sm min-w-[120px] h-7 px-1"
                  />
                </div>
              </div>
              
              {showSuggestions && tagSuggestions.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto">
                  <div className="p-1">
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
                          type="button"
                          onClick={() => addTag(tag)}
                          className="w-full px-3 py-2 text-left hover:bg-accent rounded-sm transition-colors flex items-center justify-between group text-sm"
                        >
                          <span className="font-medium group-hover:text-accent-foreground transition-colors">{tag.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-semibold uppercase", typeColors[tag.type])}>
                              {tag.type}
                            </span>
                            <span className="text-xs text-muted-foreground">{tag.count}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Press Enter to add tags • Suggestions appear as you type</p>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <Label>Content Rating <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: 'safe' as const, icon: Shield, label: 'Safe', color: 'text-green-400', activeClass: 'border-green-500 bg-green-500/10', desc: 'No objectionable content' },
                { value: 'questionable' as const, icon: AlertTriangle, label: 'Questionable', color: 'text-yellow-400', activeClass: 'border-yellow-500 bg-yellow-500/10', desc: 'Suggestive content' },
                { value: 'explicit' as const, icon: Ban, label: 'Explicit', color: 'text-red-400', activeClass: 'border-red-500 bg-red-500/10', desc: 'Adult content' },
              ].map(({ value, icon: Icon, label, color, activeClass, desc }) => (
                <div
                  key={value}
                  onClick={() => setRating(value)}
                  className={cn(
                    "cursor-pointer flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:bg-accent",
                    rating === value ? activeClass : "border-muted bg-card"
                  )}
                >
                  <Icon className={cn("h-6 w-6", color)} />
                  <div className="text-center">
                    <span className="block text-sm font-semibold mb-0.5">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Generated Toggle */}
          <div className="flex items-center space-x-2 border rounded-lg p-4 bg-card">
            <Checkbox 
              id="ai-generated" 
              checked={isAIGenerated}
              onCheckedChange={(checked) => setIsAIGenerated(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="ai-generated"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4 text-purple-400" />
                AI Generated
              </label>
              <p className="text-xs text-muted-foreground">
                Mark if this image was created by AI
              </p>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Source URL (Optional)</Label>
            <Input
              id="source"
              type="url"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com/artwork"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add a description for your image..."
              className="resize-none"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={uploading}
          className="w-full h-12 text-lg"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Upload Image
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
