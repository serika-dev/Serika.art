export type Param = { name: string; type: string; required?: boolean; default?: string; description: string };
export type Endpoint = {
  id: string; method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'; path: string; title: string;
  description: string; longDescription?: string; auth: boolean; permission?: string;
  params?: Param[]; body?: Param[]; headers?: Param[];
  responseExample: string; errorCodes?: { code: number; meaning: string }[];
  notes?: string[]; curlExample?: string;
};

export const endpoints: Endpoint[] = [
  {
    id: 'list-images', method: 'GET', path: '/api/v1/images', title: 'List Images',
    description: 'Retrieve a paginated list of images with advanced filtering, tag constraints, and sorting.',
    longDescription: 'Returns public, non-deleted, non-unlisted images. Supports multi-tag intersection filtering (all specified tags must match), rating filters, AI content filtering, dimension constraints, and full-text search across tags, descriptions, and usernames. Results include pre-fetched tags and engagement stats.',
    auth: true, permission: 'images:read',
    params: [
      { name: 'page', type: 'integer', default: '1', description: 'Page number for pagination.' },
      { name: 'limit', type: 'integer', default: '20', description: 'Results per page. Min: 1, Max: 100.' },
      { name: 'tags', type: 'string', description: 'Comma-separated tag names. Only images matching ALL tags are returned (intersection).' },
      { name: 'ratings', type: 'string', default: 'safe', description: 'Comma-separated ratings: safe, questionable, explicit.' },
      { name: 'sort', type: 'string', default: 'newest', description: 'Sort order: newest, oldest, popular, favorites, views, random.' },
      { name: 'ai', type: 'boolean', description: 'Set to true to only return AI-generated images.' },
      { name: 'q', type: 'string', description: 'Full-text search across tags, descriptions, and usernames.' },
      { name: 'user_id', type: 'string', description: 'Filter by uploader user ID.' },
      { name: 'min_width', type: 'integer', default: '0', description: 'Minimum image width in pixels.' },
      { name: 'min_height', type: 'integer', default: '0', description: 'Minimum image height in pixels.' },
    ],
    responseExample: `{
  "success": true,
  "data": [
    {
      "id": "6172269",
      "post_id": 3086270,
      "url": "https://cdn.serika.art/uploads/image.jpg",
      "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-image.jpg",
      "width": 1920, "height": 1080,
      "file_size": 333250,
      "rating": "safe",
      "is_ai_generated": false,
      "tags": [
        { "name": "landscape", "type": "general" },
        { "name": "sunset", "type": "general" }
      ],
      "stats": { "upvotes": 42, "downvotes": 2, "favorites": 15, "views": 1337 },
      "user": { "id": "abc123", "username": "artist" },
      "created_at": "2026-01-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 2535893, "pages": 126795, "has_next": true, "has_prev": false }
  }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/images?page=1&limit=20&tags=landscape,nature&sort=popular"`,
    notes: [
      'Tag filtering uses intersection — all specified tags must be present on the image.',
      'The sort=random option uses PostgreSQL RANDOM() and is not deterministic between requests.',
      'Results exclude deleted and unlisted images automatically.',
    ],
  },
  {
    id: 'get-image', method: 'GET', path: '/api/v1/images/:id', title: 'Get Image Details',
    description: 'Fetch complete metadata for a single image by its sequential ID.',
    longDescription: 'Returns full image data including all tags, engagement statistics (upvotes, downvotes, favorites, views, score, comment count), uploader info, source URL, and timestamps. Automatically increments the view counter.',
    auth: true, permission: 'images:read',
    params: [
      { name: 'id', type: 'integer', required: true, description: 'The sequential ID of the image (post_id).' },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "6172269",
    "post_id": 3086270,
    "url": "https://cdn.serika.art/uploads/image.jpg",
    "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-image.jpg",
    "original_filename": "sunset_photo.jpg",
    "width": 1920, "height": 1080,
    "file_size": 333250,
    "content_type": "image/jpeg",
    "rating": "safe",
    "is_ai_generated": false,
    "source": "https://example.com/original",
    "description": "A beautiful sunset over the mountains",
    "tags": [
      { "name": "landscape", "type": "general" },
      { "name": "artist_name", "type": "artist" }
    ],
    "stats": {
      "upvotes": 42, "downvotes": 2, "favorites": 15,
      "views": 1337, "score": 40, "comments": 5
    },
    "user": { "id": "abc123", "username": "artist" },
    "created_at": "2026-01-15T12:00:00.000Z",
    "updated_at": "2026-01-16T08:30:00.000Z"
  }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/images/3086270"`,
    notes: ['Each GET request increments the view counter (non-blocking).', 'The id parameter accepts the sequential ID (post_id), not the internal database UUID.'],
  },
  {
    id: 'delete-image', method: 'DELETE', path: '/api/v1/images/:id', title: 'Delete Image',
    description: 'Permanently delete an image and all associated data.',
    longDescription: 'Deletes the image record along with all votes, favorites, comments, and tag associations in a single atomic transaction. Tag counts are decremented accordingly. Requires either image ownership or admin rank.',
    auth: true, permission: 'images:delete',
    params: [{ name: 'id', type: 'integer', required: true, description: 'Sequential ID of the image to delete.' }],
    responseExample: `{ "success": true, "data": { "deleted": true, "id": "6172269" } }`,
    curlExample: `curl -X DELETE -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/images/3086270"`,
    errorCodes: [
      { code: 403, meaning: 'You do not own this image and are not an admin.' },
      { code: 404, meaning: 'Image not found.' },
    ],
  },
  {
    id: 'similar-images', method: 'GET', path: '/api/v1/images/:id/similar', title: 'Similar Images',
    description: 'Find images visually related to a source image based on shared tags.',
    longDescription: 'Uses a tag-intersection algorithm: finds all other public images that share tags with the source image, ranks them by the number of shared tags (descending), then by upvotes. Only returns images with the same rating as the source. Each result includes shared_tags count and up to 10 tags.',
    auth: true, permission: 'images:read',
    params: [
      { name: 'id', type: 'integer', required: true, description: 'Sequential ID of the source image.' },
      { name: 'limit', type: 'integer', default: '10', description: 'Number of similar images to return. Min: 1, Max: 50.' },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "source_id": "3086270",
    "similar": [
      {
        "id": "6172100",
        "post_id": 3086100,
        "sequential_id": 3086100,
        "url": "https://cdn.serika.art/uploads/similar.jpg",
        "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-similar.jpg",
        "width": 1440, "height": 900,
        "rating": "safe",
        "is_ai_generated": false,
        "shared_tags": 5,
        "tags": [{ "name": "landscape", "type": "general" }],
        "stats": { "upvotes": 15, "downvotes": 0, "favorites": 8, "views": 420 }
      }
    ],
    "count": 10
  }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/images/3086270/similar?limit=10"`,
    notes: ['Only returns images with the same rating as the source image.', 'Results are ranked by shared_tags DESC, then upvotes DESC.', 'Deleted and unlisted images are automatically excluded.'],
  },
  {
    id: 'random', method: 'GET', path: '/api/v1/random', title: 'Random Images',
    description: 'Fetch random images with optional tag, rating, dimension, and AI filters.',
    longDescription: 'Returns one or more random public images. Supports include/exclude tag filtering, rating restrictions, dimension constraints, and AI content filtering. When count=1, data is a single object; otherwise an array.',
    auth: true, permission: 'random:read',
    params: [
      { name: 'count', type: 'integer', default: '1', description: 'Number of random images. Min: 1, Max: 50.' },
      { name: 'ratings', type: 'string', default: 'safe', description: 'Comma-separated ratings to include.' },
      { name: 'tags', type: 'string', description: 'Required tags (comma-separated). All must match.' },
      { name: 'exclude_tags', type: 'string', description: 'Tags to exclude (comma-separated).' },
      { name: 'min_width', type: 'integer', description: 'Minimum width in pixels.' },
      { name: 'min_height', type: 'integer', description: 'Minimum height in pixels.' },
      { name: 'max_width', type: 'integer', description: 'Maximum width in pixels.' },
      { name: 'max_height', type: 'integer', description: 'Maximum height in pixels.' },
      { name: 'ai', type: 'boolean', description: 'true = AI-generated only.' },
      { name: 'no_ai', type: 'boolean', description: 'true = exclude AI-generated images.' },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "5000001",
    "post_id": 2500000,
    "url": "https://cdn.serika.art/uploads/random.jpg",
    "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-random.jpg",
    "width": 2560, "height": 1440,
    "rating": "safe",
    "tags": [{ "name": "nature", "type": "general" }],
    "stats": { "upvotes": 10, "favorites": 3, "views": 200 },
    "user": { "id": "xyz", "username": "photographer" },
    "created_at": "2026-03-10T14:00:00.000Z"
  },
  "meta": { "count": 1, "requested": 1 }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/random?count=5&tags=nature&no_ai=true"`,
  },
  {
    id: 'random-image', method: 'GET', path: '/api/v1/random/:width/:height/image.png', title: 'Random Image Stream',
    description: 'Returns a random image file directly, resized to the given dimensions. No API key required.',
    longDescription: 'Streams the actual image binary — perfect for <img> tags, Discord embeds, and wallpaper apps. Supports format conversion (PNG/JPEG/WebP), quality control, blur/grayscale effects, and aspect ratio matching. Response headers include image metadata.',
    auth: false,
    params: [
      { name: 'width', type: 'integer', required: true, description: 'Output width (16–8000).' },
      { name: 'height', type: 'integer', required: true, description: 'Output height (16–8000).' },
      { name: 'fit', type: 'string', default: 'cover', description: 'Resize mode: cover, contain, fill, inside, outside.' },
      { name: 'format', type: 'string', default: 'png', description: 'Output format: png, jpeg, webp.' },
      { name: 'quality', type: 'integer', default: '85', description: 'Output quality (1–100). Only applies to jpeg/webp.' },
      { name: 'tags', type: 'string', description: 'Filter by tags.' },
      { name: 'ratings', type: 'string', default: 'safe', description: 'Filter by rating.' },
      { name: 'blur', type: 'boolean', description: 'Apply Gaussian blur.' },
      { name: 'grayscale', type: 'boolean', description: 'Convert to grayscale.' },
    ],
    headers: [
      { name: 'X-Image-Id', type: 'string', description: 'Database ID of the selected image.' },
      { name: 'X-Post-Id', type: 'string', description: 'Sequential ID of the selected image.' },
      { name: 'X-Original-Width', type: 'string', description: 'Original width before resize.' },
      { name: 'X-Original-Height', type: 'string', description: 'Original height before resize.' },
      { name: 'X-Rating', type: 'string', description: 'Content rating of the image.' },
    ],
    responseExample: `Binary image data (Content-Type: image/png)

Response headers:
  X-Image-Id: 6172269
  X-Post-Id: 3086270
  X-Original-Width: 1920
  X-Original-Height: 1080
  X-Rating: safe`,
    curlExample: `# Use directly in HTML:
<img src="https://serika.art/api/v1/random/400/400/image.png" />

# With filters:
<img src="https://serika.art/api/v1/random/1920/1080/image.png?format=webp&tags=nature&fit=cover" />`,
  },
  {
    id: 'list-tags', method: 'GET', path: '/api/v1/tags', title: 'List Tags',
    description: 'Retrieve a paginated, searchable list of all tags on the platform.',
    auth: true, permission: 'tags:read',
    params: [
      { name: 'page', type: 'integer', default: '1', description: 'Page number.' },
      { name: 'limit', type: 'integer', default: '100', description: 'Results per page. Max: 500.' },
      { name: 'q', type: 'string', description: 'Search query (case-insensitive substring match).' },
      { name: 'type', type: 'string', description: 'Filter by type: general, artist, character, copyright, meta.' },
      { name: 'sort', type: 'string', default: 'count', description: 'Sort: count, name, newest, oldest.' },
      { name: 'min_count', type: 'integer', default: '0', description: 'Minimum usage count.' },
    ],
    responseExample: `{
  "success": true,
  "data": [
    { "id": "1", "name": "landscape", "type": "general", "count": 45231, "created_at": "2025-01-01T00:00:00Z" },
    { "id": "2", "name": "portrait", "type": "general", "count": 38100, "created_at": "2025-01-01T00:00:00Z" }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 100, "total": 511429, "pages": 5115, "has_next": true }
  }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/tags?q=land&type=general&sort=count&limit=50"`,
  },
  {
    id: 'get-user', method: 'GET', path: '/api/v1/users/:identifier', title: 'Get User Profile',
    description: 'Fetch a user\'s public profile and statistics by ID or username.',
    auth: true, permission: 'users:read',
    params: [
      { name: 'identifier', type: 'string', required: true, description: 'User ID or username (case-insensitive).' },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "abc123",
    "username": "artist",
    "avatar_url": "https://cdn.serika.art/avatars/user.jpg",
    "rank": "user",
    "stats": { "images": 42, "total_upvotes": 1337, "total_views": 50000 },
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}`,
    curlExample: `curl -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  "https://serika.art/api/v1/users/artist"`,
  },
  {
    id: 'upload', method: 'POST', path: '/api/v1/upload', title: 'Upload Image',
    description: 'Upload a new image to the platform. Requires moderator rank or above.',
    longDescription: 'Accepts multipart/form-data with the image file, tags, and metadata. The server automatically generates a thumbnail, extracts dimensions, uploads to CDN storage, creates tag records (or reuses existing ones), and assigns a sequential post ID.',
    auth: true, permission: 'upload',
    body: [
      { name: 'file', type: 'File', required: true, description: 'Image file. Supported: JPEG, PNG, GIF, WebP. Max: 50MB.' },
      { name: 'tags', type: 'string', required: true, description: 'JSON array of tag objects or comma-separated string. Min 1, Max 100 tags.' },
      { name: 'rating', type: 'string', required: true, description: 'Content rating: safe, questionable, or explicit.' },
      { name: 'is_ai_generated', type: 'boolean', default: 'false', description: 'Whether the image is AI-generated.' },
      { name: 'source', type: 'string', description: 'Original source URL.' },
      { name: 'description', type: 'string', description: 'Image description.' },
    ],
    responseExample: `{
  "success": true,
  "data": {
    "id": "6172270",
    "post_id": 3086271,
    "url": "https://cdn.serika.art/uploads/image.png",
    "thumbnail_url": "https://cdn.serika.art/thumbnails/thumb-image.jpg",
    "width": 1920, "height": 1080,
    "file_size": 2048000,
    "rating": "safe",
    "is_ai_generated": false,
    "tags": [{ "name": "nature", "type": "general" }],
    "created_at": "2026-05-28T12:00:00.000Z"
  },
  "meta": { "message": "Image uploaded successfully" }
}`,
    curlExample: `curl -X POST "https://serika.art/api/v1/upload" \\
  -H "Authorization: Bearer sk_serika_YOUR_KEY" \\
  -F "file=@photo.png" \\
  -F 'tags=[{"name":"nature","type":"general"},{"name":"sunset","type":"general"}]' \\
  -F "rating=safe" \\
  -F "is_ai_generated=false"`,
    notes: [
      'Tags can be a JSON array: [{"name":"tag","type":"general"}] or comma-separated: "tag1, tag2".',
      'Valid tag types: general, artist, character, copyright, meta.',
      'A 320×320 JPEG thumbnail is automatically generated.',
    ],
  },
  {
    id: 'stats', method: 'GET', path: '/api/v1/stats', title: 'Platform Statistics',
    description: 'Get global platform statistics. No authentication required.',
    auth: false,
    responseExample: `{
  "success": true,
  "data": {
    "totals": { "images": 3086271, "tags": 511429, "users": 1016 },
    "images_by_rating": { "safe": 2100000, "questionable": 700000, "explicit": 286271 },
    "images_by_type": { "ai_generated": 450000, "non_ai": 2636271 },
    "activity": { "uploads_last_24h": 150 }
  }
}`,
    curlExample: `curl "https://serika.art/api/v1/stats"`,
  },
];
