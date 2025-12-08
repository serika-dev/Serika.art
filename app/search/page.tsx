'use client';

import { useState } from 'react';
import { Search as SearchIcon, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState('');
  const [rating, setRating] = useState('');
  const [aiOnly, setAiOnly] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (tags) params.append('tags', tags);
    if (rating) params.append('rating', rating);
    if (aiOnly) params.append('ai', 'true');

    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-800">
        <h1 className="text-3xl font-bold text-white mb-6">Advanced Search</h1>
        
        <form onSubmit={handleSearch} className="space-y-6">
          {/* Search Query */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Search
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search images..."
                className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-zinc-600"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-zinc-600"
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Rating
            </label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
            >
              <option value="">All Ratings</option>
              <option value="safe">Safe</option>
              <option value="questionable">Questionable</option>
              <option value="explicit">Explicit</option>
            </select>
          </div>

          {/* AI Only */}
          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiOnly}
                onChange={(e) => setAiOnly(e.target.checked)}
                className="mr-3 w-5 h-5 text-blue-600 border-zinc-700 rounded focus:ring-blue-500 bg-zinc-950"
              />
              <span className="text-sm font-medium text-zinc-300">AI Generated Only</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition flex items-center justify-center gap-2"
          >
            <Filter size={20} />
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
