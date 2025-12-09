'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Tag, Sparkles, Shield, AlertTriangle, Ban } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Tag as TagModel } from '@/lib/models';

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
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Upload size={36} className="text-blue-500" />
          Upload Image
        </h1>
        <p className="text-zinc-400">
          {!user ? (
            <span className="text-yellow-400">
              Uploading anonymously - images will be attributed to "Anonymous"
            </span>
          ) : (
            'Share your artwork with the community'
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border-2 border-red-500/30 text-red-300 px-6 py-4 rounded-xl mb-6 font-medium">
          {error}
        </div>
      )}

      {/* File Upload */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-white mb-3">Image</label>
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-700 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-500 hover:bg-zinc-900/50 transition-all group"
          >
            <Upload className="mx-auto mb-4 text-zinc-600 group-hover:text-blue-500 transition" size={64} />
            <p className="text-zinc-300 text-lg font-medium mb-1">Click to select an image</p>
            <p className="text-sm text-zinc-500">PNG, JPG, GIF up to 10MB</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border-2 border-zinc-800">
            <img src={preview} alt="Preview" className="w-full max-h-[32rem] object-contain" />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition shadow-lg"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Tags */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">
          Tags <span className="text-red-400">*</span>
        </label>
        <div className="border-2 border-zinc-700 rounded-xl p-4 bg-zinc-900 relative focus-within:border-blue-500 transition">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => {
                const typeColors = {
                  artist: 'bg-red-500/10 border-red-500/30 text-red-300',
                  copyright: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
                  character: 'bg-green-500/10 border-green-500/30 text-green-300',
                  general: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
                  meta: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
                };
                const tagType: TagType = (tag.type as TagType) || 'general';
                return (
                  <span
                    key={tag.name}
                    className={`${typeColors[tagType]} px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border`}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => removeTag(tag.name)}
                      className="hover:opacity-70 transition"
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagAdd}
            placeholder="Start typing to search tags..."
            className="w-full outline-none text-base bg-transparent text-white placeholder-zinc-500"
          />
          {showSuggestions && tagSuggestions.length > 0 && (
            <div className="absolute z-10 w-full left-0 top-full mt-2 bg-zinc-800 border-2 border-zinc-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
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
                    className="w-full px-4 py-3 text-left hover:bg-zinc-700 transition flex items-center justify-between group"
                  >
                    <span className="text-sm font-medium text-white group-hover:text-blue-300 transition">{tag.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold uppercase ${typeColors[tag.type]}`}>
                        {tag.type}
                      </span>
                      <span className="text-xs text-zinc-500">{tag.count}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-2">💡 Press Enter to add tags • Suggestions appear as you type</p>
      </div>

      {/* Rating */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-white mb-3">
          Content Rating <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'safe' as const, icon: Shield, label: 'Safe', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20', activeBg: 'bg-green-500/20 border-green-500', desc: 'No objectionable content' },
            { value: 'questionable' as const, icon: AlertTriangle, label: 'Questionable', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20', activeBg: 'bg-yellow-500/20 border-yellow-500', desc: 'Suggestive content' },
            { value: 'explicit' as const, icon: Ban, label: 'Explicit', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20', activeBg: 'bg-red-500/20 border-red-500', desc: 'Adult content' },
          ].map(({ value, icon: Icon, label, color, bgColor, activeBg, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition ${
                rating === value ? activeBg : bgColor
              }`}
            >
              <Icon className={color} size={28} />
              <div className="text-center">
                <span className="block text-base font-semibold text-white mb-1">{label}</span>
                <span className="text-xs text-zinc-400">{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Generated Toggle */}
      <div className="mb-8">
        <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border-2 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition">
          <input
            type="checkbox"
            checked={isAIGenerated}
            onChange={(e) => setIsAIGenerated(e.target.checked)}
            className="w-5 h-5 rounded bg-zinc-800 border-zinc-700 text-purple-500 focus:ring-2 focus:ring-purple-500"
          />
          <Sparkles className="text-purple-400" size={22} />
          <div>
            <span className="block text-base font-semibold text-white">AI Generated</span>
            <span className="text-xs text-zinc-400">Mark if this image was created by AI</span>
          </div>
        </label>
      </div>

      {/* Source */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-white mb-3">Source URL (Optional)</label>
        <input
          type="url"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://example.com/artwork"
          className="w-full px-4 py-3 bg-zinc-900 border-2 border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-zinc-500 transition"
        />
      </div>

      {/* Description */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-white mb-3">Description (Optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Add a description for your image..."
          className="w-full px-4 py-3 bg-zinc-900 border-2 border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-zinc-500 transition resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={uploading}
        className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg rounded-xl transition-all disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-500/25"
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
            Uploading...
          </>
        ) : (
          <>
            <Upload size={24} />
            Upload Image
          </>
        )}
      </button>
    </form>
  );
}
