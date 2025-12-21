'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', name: 'Overview' },
    { id: 'authentication', name: 'Authentication' },
    { id: 'rate-limits', name: 'Rate Limits' },
    { id: 'images', name: 'Images' },
    { id: 'similar', name: 'Similar Images' },
    { id: 'trending', name: 'Trending' },
    { id: 'batch', name: 'Batch Operations' },
    { id: 'search', name: 'Search' },
    { id: 'random', name: 'Random' },
    { id: 'tags', name: 'Tags' },
    { id: 'users', name: 'Users' },
    { id: 'upload', name: 'Upload' },
    { id: 'stats', name: 'Stats' },
    { id: 'errors', name: 'Error Codes' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 flex-shrink-0 sticky top-8 h-fit">
            <h1 className="text-2xl font-bold mb-6 text-indigo-400">Serika API</h1>
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {section.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {/* Overview */}
            <section id="overview" className={activeSection === 'overview' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">API Overview</h2>
              <p className="text-gray-300 mb-4">
                Welcome to the Serika API! This API allows you to access and interact with the Serika
                image platform programmatically.
              </p>
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-2">Base URL</h3>
                <code className="text-indigo-400">https://serika.art/api/v1</code>
              </div>
              <div className="bg-[#111] rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-300">
                  <li>Create an account on Serika</li>
                  <li>Generate an API key from your account settings</li>
                  <li>Include your API key in requests</li>
                  <li>Start making API calls!</li>
                </ol>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" className={activeSection === 'authentication' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Authentication</h2>
              <p className="text-gray-300 mb-4">
                All API endpoints (except stats) require authentication using an API key.
              </p>
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Methods</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-indigo-400">Authorization Header (Recommended)</h4>
                    <pre className="bg-black/50 rounded p-3 mt-2 overflow-x-auto">
                      <code>Authorization: Bearer sk_serika_YOUR_API_KEY</code>
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium text-indigo-400">X-API-Key Header</h4>
                    <pre className="bg-black/50 rounded p-3 mt-2 overflow-x-auto">
                      <code>X-API-Key: sk_serika_YOUR_API_KEY</code>
                    </pre>
                  </div>
                </div>
              </div>
              <div className="bg-[#111] rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Permissions</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2">Permission</th>
                      <th className="text-left py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>images:read</code></td>
                      <td>View images and their metadata</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>images:write</code></td>
                      <td>Modify image metadata</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>images:delete</code></td>
                      <td>Delete images (admin only)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags:read</code></td>
                      <td>View tags</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags:write</code></td>
                      <td>Create/modify tags</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>users:read</code></td>
                      <td>View user profiles</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>random:read</code></td>
                      <td>Access random image endpoints</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>upload</code></td>
                      <td>Upload images (moderator+ only)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Rate Limits */}
            <section id="rate-limits" className={activeSection === 'rate-limits' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Rate Limits</h2>
              <p className="text-gray-300 mb-4">
                Rate limits are applied per API key to ensure fair usage.
              </p>
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Default Limits</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2">User Rank</th>
                      <th className="text-left py-2">Requests/Minute</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2">User</td>
                      <td>60</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">Premium User</td>
                      <td>120</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">Moderator</td>
                      <td>120</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">Admin</td>
                      <td>1000</td>
                    </tr>
                    <tr>
                      <td className="py-2">Owner</td>
                      <td>10000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-[#111] rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Rate Limit Response</h3>
                <pre className="bg-black/50 rounded p-3 mt-2 overflow-x-auto text-sm">
{`{
  "success": false,
  "error": "Rate limit exceeded. Try again in X seconds",
  "code": "RATE_LIMITED"
}`}
                </pre>
              </div>
            </section>

            {/* Images */}
            <section id="images" className={activeSection === 'images' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Images</h2>
              
              {/* List Images */}
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/images</code>
                </div>
                <p className="text-gray-300 mb-4">List images with pagination and filters.</p>
                
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>page</code></td>
                      <td>Page number (default: 1)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>limit</code></td>
                      <td>Items per page (1-100, default: 20)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags</code></td>
                      <td>Comma-separated tag names</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ratings</code></td>
                      <td>safe, questionable, explicit</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>sort</code></td>
                      <td>newest, oldest, popular, favorites, views, random</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ai</code></td>
                      <td>true to show only AI images</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>q</code></td>
                      <td>Search query</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>min_width</code></td>
                      <td>Minimum image width</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>min_height</code></td>
                      <td>Minimum image height</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "url": "https://cdn.serika.art/uploads/image.png",
      "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-image.jpg",
      "width": 1920,
      "height": 1080,
      "file_size": 1234567,
      "content_type": "image/png",
      "rating": "safe",
      "is_ai_generated": false,
      "source": "https://example.com",
      "description": "A beautiful image",
      "tags": [
        { "name": "landscape", "type": "general" },
        { "name": "nature", "type": "general" }
      ],
      "stats": {
        "upvotes": 42,
        "downvotes": 2,
        "favorites": 15,
        "views": 1337
      },
      "user": {
        "id": "507f1f77bcf86cd799439012",
        "username": "artist"
      },
      "created_at": "2024-01-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "timestamp": "2024-01-15T12:00:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5,
      "has_next": true,
      "has_prev": false
    }
  }
}`}
                </pre>
              </div>

              {/* Get Image */}
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/images/:id</code>
                </div>
                <p className="text-gray-300 mb-4">Get detailed information about a specific image.</p>
                
                <h4 className="font-semibold mb-2">Path Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr>
                      <td className="py-2"><code>id</code></td>
                      <td>Image ID (MongoDB ObjectId)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Similar Images */}
            <section id="similar" className={activeSection === 'similar' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Similar Images</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/images/:id/similar</code>
                </div>
                <p className="text-gray-300 mb-4">Get images similar to the specified image based on shared tags.</p>
                
                <h4 className="font-semibold mb-2">Path Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr>
                      <td className="py-2"><code>id</code></td>
                      <td>Source image ID</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr>
                      <td className="py-2"><code>limit</code></td>
                      <td>Number of results (1-50, default: 10)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "source_id": "507f1f77bcf86cd799439011",
    "similar": [
      {
        "id": "507f1f77bcf86cd799439012",
        "sequential_id": 42,
        "url": "https://cdn.serika.art/...",
        "thumbnail_url": "https://cdn.serika.art/...",
        "shared_tags": 5,
        "tags": [{"name": "landscape", "type": "general"}],
        "stats": {"upvotes": 15, "favorites": 8}
      }
    ],
    "count": 10
  }
}`}
                </pre>
              </div>
            </section>

            {/* Trending */}
            <section id="trending" className={activeSection === 'trending' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Trending</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/trending</code>
                </div>
                <p className="text-gray-300 mb-4">Get trending images and tags based on recent engagement.</p>
                
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>period</code></td>
                      <td>Time period: day, week, month (default: day)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>limit</code></td>
                      <td>Number of images (1-50, default: 20)</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>ratings</code></td>
                      <td>Filter by rating (default: safe)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "period": "day",
    "images": [
      {
        "id": "507f1f77bcf86cd799439011",
        "trend_score": 250,
        "tags": ["landscape", "nature"],
        "stats": {"upvotes": 42, "favorites": 15, "views": 1337}
      }
    ],
    "tags": [
      {"name": "landscape", "type": "general", "trending_count": 15}
    ]
  }
}`}
                </pre>
              </div>
            </section>

            {/* Batch Operations */}
            <section id="batch" className={activeSection === 'batch' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Batch Operations</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-blue-600 px-2 py-1 rounded text-xs font-bold">POST</span>
                  <code className="text-indigo-400">/batch/images</code>
                </div>
                <p className="text-gray-300 mb-4">Fetch multiple images by ID in a single request. More efficient than multiple individual requests.</p>
                
                <h4 className="font-semibold mb-2">Request Body</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm mb-4">
{`{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}`}
                </pre>

                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3 mb-4">
                  <p className="text-yellow-400 text-sm">
                    <strong>Limit:</strong> Maximum 100 IDs per request
                  </p>
                </div>

                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "images": [...],
    "found": 3,
    "requested": 3
  }
}`}
                </pre>
              </div>
            </section>

            {/* Search */}
            <section id="search" className={activeSection === 'search' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Search</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/search</code>
                </div>
                <p className="text-gray-300 mb-4">Search across images, tags, and users with a single query.</p>
                
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>q</code> <span className="text-red-400">*</span></td>
                      <td>Search query (min 2 characters)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>type</code></td>
                      <td>all, images, tags, users (default: all)</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>limit</code></td>
                      <td>Results per type (1-50, default: 10)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "images": [...],
    "tags": [
      {"name": "landscape", "type": "general", "count": 1234}
    ],
    "users": [
      {"username": "artist", "avatar_url": "..."}
    ]
  }
}`}
                </pre>
              </div>
            </section>

            {/* Random */}
            <section id="random" className={activeSection === 'random' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Random Images</h2>
              
              {/* Random API */}
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/random</code>
                </div>
                <p className="text-gray-300 mb-4">Get random image(s) with metadata (JSON response).</p>
                
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>count</code></td>
                      <td>Number of images (1-50, default: 1)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ratings</code></td>
                      <td>Comma-separated ratings</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags</code></td>
                      <td>Required tags (comma-separated)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>exclude_tags</code></td>
                      <td>Tags to exclude</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>min_width</code></td>
                      <td>Minimum width</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>min_height</code></td>
                      <td>Minimum height</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>max_width</code></td>
                      <td>Maximum width</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>max_height</code></td>
                      <td>Maximum height</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ai</code></td>
                      <td>true for AI-only images</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>no_ai</code></td>
                      <td>true to exclude AI images</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Random Image Direct */}
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/random/:width/:height/image.png</code>
                </div>
                <p className="text-gray-300 mb-4">
                  Get a random image resized to specific dimensions. Returns the actual image file.
                  <span className="text-yellow-400 ml-2">(No API key required)</span>
                </p>
                
                <h4 className="font-semibold mb-2">Path Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>width</code></td>
                      <td>Output width (16-8000)</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>height</code></td>
                      <td>Output height (16-8000)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ratings</code></td>
                      <td>Filter by rating (default: safe)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags</code></td>
                      <td>Filter by tags (comma-separated)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>exclude_tags</code></td>
                      <td>Tags to exclude (comma-separated)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>fit</code></td>
                      <td>cover, contain, fill, inside, outside (default: cover)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>format</code></td>
                      <td>png, jpeg, webp (default: png)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>quality</code></td>
                      <td>Output quality 1-100 (default: 85)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>blur</code></td>
                      <td>true to apply blur effect</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>grayscale</code></td>
                      <td>true for grayscale output</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>ai</code></td>
                      <td>true for AI-only images</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>no_ai</code></td>
                      <td>true to exclude AI images</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>match_size</code></td>
                      <td>false to disable dimension matching (default: true)</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>aspect_tolerance</code></td>
                      <td>Aspect ratio tolerance 0-1 (default: 0.2)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Response Headers</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>X-Image-Id</code></td>
                      <td>Original image ID</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>X-Original-Width</code></td>
                      <td>Original image width</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>X-Original-Height</code></td>
                      <td>Original image height</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>X-Rating</code></td>
                      <td>Image rating</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Usage</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`<!-- HTML -->
<img src="https://serika.art/api/v1/random/400/400/image.png" alt="Random">

<!-- With filters -->
<img src="https://serika.art/api/v1/random/800/600/image.png?format=webp&tags=nature" alt="Random Nature">

<!-- Placeholder -->
<img src="https://serika.art/api/v1/random/1920/1080/image.png?fit=cover" alt="Background">`}
                </pre>
              </div>
            </section>

            {/* Tags */}
            <section id="tags" className={activeSection === 'tags' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Tags</h2>
              
              <div className="bg-[#111] rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/tags</code>
                </div>
                <p className="text-gray-300 mb-4">List all tags with pagination.</p>
                
                <h4 className="font-semibold mb-2">Query Parameters</h4>
                <table className="w-full text-sm">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>page</code></td>
                      <td>Page number</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>limit</code></td>
                      <td>Items per page (max 500)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>q</code></td>
                      <td>Search query</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>type</code></td>
                      <td>general, artist, character, copyright, meta</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>sort</code></td>
                      <td>count, name, newest, oldest</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>min_count</code></td>
                      <td>Minimum usage count</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/tags/:name</code>
                </div>
                <p className="text-gray-300 mb-4">Get detailed information about a specific tag.</p>
              </div>
            </section>

            {/* Users */}
            <section id="users" className={activeSection === 'users' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Users</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/users/:identifier</code>
                </div>
                <p className="text-gray-300 mb-4">Get a user's public profile and statistics by ID or username.</p>
                
                <h4 className="font-semibold mb-2">Path Parameters</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr>
                      <td className="py-2"><code>identifier</code></td>
                      <td>User ID (MongoDB ObjectId) or username (case-insensitive)</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Example Requests</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm mb-4">
{`GET /api/v1/users/507f1f77bcf86cd799439012  # By ID
GET /api/v1/users/artist                     # By username`}
                </pre>
                
                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "username": "artist",
    "avatar_url": "https://cdn.serika.art/avatars/user.jpg",
    "rank": "user",
    "stats": {
      "images": 42,
      "total_upvotes": 1337,
      "total_views": 50000
    },
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}`}
                </pre>
              </div>
            </section>

            {/* Upload */}
            <section id="upload" className={activeSection === 'upload' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Upload</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-blue-600 px-2 py-1 rounded text-xs font-bold">POST</span>
                  <code className="text-indigo-400">/upload</code>
                </div>
                <p className="text-gray-300 mb-4">
                  Upload an image. Requires <code>upload</code> permission (moderator+ only).
                </p>
                
                <h4 className="font-semibold mb-2">Request Body (multipart/form-data)</h4>
                <table className="w-full text-sm mb-4">
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>file</code> <span className="text-red-400">*</span></td>
                      <td>Image file (JPEG, PNG, GIF, WebP, max 50MB)</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>tags</code> <span className="text-red-400">*</span></td>
                      <td>JSON array of tags or comma-separated string</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>rating</code> <span className="text-red-400">*</span></td>
                      <td>safe, questionable, or explicit</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>is_ai_generated</code></td>
                      <td>true/false</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><code>source</code></td>
                      <td>Source URL</td>
                    </tr>
                    <tr>
                      <td className="py-2"><code>description</code></td>
                      <td>Image description</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2">Tags Format</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`// Simple comma-separated
"nature, landscape, mountains"

// JSON with types
[
  { "name": "artist_name", "type": "artist" },
  { "name": "character_name", "type": "character" },
  { "name": "landscape", "type": "general" }
]`}
                </pre>

                <h4 className="font-semibold mb-2 mt-4">Example (cURL)</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`curl -X POST https://serika.art/api/v1/upload \\
  -H "Authorization: Bearer sk_serika_YOUR_API_KEY" \\
  -F "file=@image.png" \\
  -F 'tags=[{"name":"nature","type":"general"}]' \\
  -F "rating=safe" \\
  -F "is_ai_generated=false"`}
                </pre>
              </div>
            </section>

            {/* Stats */}
            <section id="stats" className={activeSection === 'stats' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Statistics</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-green-600 px-2 py-1 rounded text-xs font-bold">GET</span>
                  <code className="text-indigo-400">/stats</code>
                </div>
                <p className="text-gray-300 mb-4">
                  Get platform statistics. <span className="text-yellow-400">(No API key required)</span>
                </p>
                
                <h4 className="font-semibold mb-2">Example Response</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": true,
  "data": {
    "totals": {
      "images": 10000,
      "tags": 5000,
      "users": 1000
    },
    "images_by_rating": {
      "safe": 7000,
      "questionable": 2000,
      "explicit": 1000
    },
    "images_by_type": {
      "ai_generated": 3000,
      "non_ai": 7000
    },
    "activity": {
      "uploads_last_24h": 150
    }
  },
  "meta": {
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}`}
                </pre>
              </div>
            </section>

            {/* Errors */}
            <section id="errors" className={activeSection === 'errors' ? '' : 'hidden'}>
              <h2 className="text-3xl font-bold mb-6">Error Codes</h2>
              
              <div className="bg-[#111] rounded-lg p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2">HTTP Status</th>
                      <th className="text-left py-2">Code</th>
                      <th className="text-left py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>INVALID_ID</code></td>
                      <td>Invalid resource ID format</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>MISSING_FILE</code></td>
                      <td>No file provided for upload</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>INVALID_FILE_TYPE</code></td>
                      <td>Unsupported file format</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>FILE_TOO_LARGE</code></td>
                      <td>File exceeds size limit</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>MISSING_TAGS</code></td>
                      <td>Tags are required</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">400</td>
                      <td><code>INVALID_RATING</code></td>
                      <td>Invalid rating value</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">401</td>
                      <td><code>UNAUTHORIZED</code></td>
                      <td>Invalid or missing API key</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">403</td>
                      <td><code>FORBIDDEN</code></td>
                      <td>Insufficient permissions</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">404</td>
                      <td><code>NOT_FOUND</code></td>
                      <td>Resource not found</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2">429</td>
                      <td><code>RATE_LIMITED</code></td>
                      <td>Too many requests</td>
                    </tr>
                    <tr>
                      <td className="py-2">500</td>
                      <td><code>INTERNAL_ERROR</code></td>
                      <td>Server error</td>
                    </tr>
                  </tbody>
                </table>

                <h4 className="font-semibold mb-2 mt-6">Error Response Format</h4>
                <pre className="bg-black/50 rounded p-3 overflow-x-auto text-sm">
{`{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}`}
                </pre>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
