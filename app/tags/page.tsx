'use client';

import { useState, useEffect } from 'react';
import { Tag as TagModel } from '@/lib/models';
import axios from 'axios';
import Link from 'next/link';
import { Hash, TrendingUp } from 'lucide-react';

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

  const getTagTypeColor = (type: TagType) => {
    switch (type) {
      case 'artist':
        return 'bg-red-900/30 text-red-200 border-red-800 hover:bg-red-900/50';
      case 'copyright':
        return 'bg-purple-900/30 text-purple-200 border-purple-800 hover:bg-purple-900/50';
      case 'character':
        return 'bg-green-900/30 text-green-200 border-green-800 hover:bg-green-900/50';
      case 'general':
        return 'bg-blue-900/30 text-blue-200 border-blue-800 hover:bg-blue-900/50';
      case 'meta':
        return 'bg-yellow-900/30 text-yellow-200 border-yellow-800 hover:bg-yellow-900/50';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700';
    }
  };

  const filterOptions: { value: TagType | 'all'; label: string; icon?: any }[] = [
    { value: 'all', label: 'All Tags', icon: Hash },
    { value: 'general', label: 'General' },
    { value: 'artist', label: 'Artist' },
    { value: 'character', label: 'Character' },
    { value: 'copyright', label: 'Copyright' },
    { value: 'meta', label: 'Meta' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Hash size={36} className="text-blue-500" />
          Tags
        </h1>
        <p className="text-zinc-400">Browse and search tags</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                  filter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {option.icon && <option.icon size={16} />}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tags Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-500">No tags found</p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <Link
                key={tag._id.toString()}
                href={`/posts?tags=${encodeURIComponent(tag.name)}`}
                className={`${getTagTypeColor(tag.type)} border px-4 py-2 rounded-lg transition flex items-center gap-2 group`}
              >
                <span className="font-medium">{tag.name}</span>
                <span className="text-xs opacity-75 group-hover:opacity-100">
                  ({tag.count})
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
