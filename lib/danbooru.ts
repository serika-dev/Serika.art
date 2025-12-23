import axios from 'axios';

const DANBOORU_API = 'https://danbooru.donmai.us';
const DANBOORU_USERNAME = process.env.DANBOORU_USERNAME || 'serika-dev';
const DANBOORU_API_KEY = process.env.DANBOORU_API_KEY || '';

// Create axios instance with authentication
const danbooruClient = axios.create({
  baseURL: DANBOORU_API,
  auth: DANBOORU_API_KEY
    ? {
        username: DANBOORU_USERNAME,
        password: DANBOORU_API_KEY,
      }
    : undefined,
});

// Rate limiting - Danbooru allows 10 req/s with API key, 1 req/s without
const hasAuth = !!DANBOORU_API_KEY;
const MAX_CONCURRENT_REQUESTS = hasAuth ? 8 : 1; // Leave some headroom
const MIN_REQUEST_INTERVAL = hasAuth ? 100 : 1000; // ms between requests

// Request queue for proper rate limiting
let activeRequests = 0;
let lastRequestTime = 0;
let rateLimitBackoff = 0;
const requestQueue: Array<{
  requestFn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
}> = [];
let processingQueue = false;

async function processRequestQueue() {
  if (processingQueue) return;
  processingQueue = true;

  while (requestQueue.length > 0) {
    // Check if we can make more requests
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }

    // Check rate limit backoff
    if (rateLimitBackoff > Date.now()) {
      const waitTime = rateLimitBackoff - Date.now();
      console.log(`[DANBOORU] Global rate limit, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    // Ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }

    const item = requestQueue.shift();
    if (!item) continue;

    lastRequestTime = Date.now();
    activeRequests++;

    // Execute request without blocking the queue
    executeRequest(item);
  }

  processingQueue = false;
}

async function executeRequest(item: typeof requestQueue[0]) {
  try {
    const result = await item.requestFn();
    item.resolve(result);
  } catch (error: any) {
    if (error.response?.status === 429 || error.response?.status === 421) {
      // Rate limited - apply exponential backoff
      const backoffTime = Math.min(1000 * Math.pow(2, 3 - item.retries), 30000);
      console.log(`[DANBOORU] Rate limited (${item.retries} retries left), backoff ${backoffTime}ms`);
      rateLimitBackoff = Date.now() + backoffTime;
      
      if (item.retries > 0) {
        // Re-queue with reduced retries
        requestQueue.unshift({ ...item, retries: item.retries - 1 });
      } else {
        item.reject(error);
      }
    } else if (error.response?.status === 410 || error.response?.status === 404) {
      // Post deleted or not found - return null
      item.resolve(null);
    } else {
      item.reject(error);
    }
  } finally {
    activeRequests--;
    // Trigger queue processing again
    processRequestQueue();
  }
}

async function rateLimitedRequest<T>(requestFn: () => Promise<T>, retries = 3): Promise<T> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ requestFn, resolve, reject, retries });
    processRequestQueue();
  });
}

export interface DanbooruPost {
  id: number;
  image_width: number;
  image_height: number;
  file_size: number;
  file_ext: string;
  file_url: string;
  large_file_url: string;
  preview_file_url: string;
  tag_string_general: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  tag_string_meta: string;
  rating: string; // s, q, e
  source: string;
  md5: string;
}

export async function fetchDanbooruPost(postId: number): Promise<DanbooruPost | null> {
  try {
    return await rateLimitedRequest(async () => {
      const response = await danbooruClient.get(`/posts/${postId}.json`);
      return response.data;
    });
  } catch (error: any) {
    if (error.response?.status !== 429) {
      console.error(`Error fetching Danbooru post ${postId}:`, error.message);
    }
    return null;
  }
}

export async function fetchDanbooruPostsByTags(
  tags: string,
  limit: number = 100 // 0 = unlimited
): Promise<DanbooruPost[]> {
  try {
    const posts: DanbooruPost[] = [];
    const unlimited = limit === 0;
    
    // Safety max to prevent infinite loops (100k posts max)
    const maxPosts = unlimited ? 100000 : limit;
    
    // Use "before ID" pagination (page=b{id}) to bypass the 1000 page limit
    // This allows fetching ALL posts, not just the first 1000
    let beforeId: number | null = null;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;
    let lastBatchSize = 0;
    
    console.log(`[DANBOORU] Starting fetch for "${tags}" (limit: ${unlimited ? 'UNLIMITED' : limit})`);
    
    while (posts.length < maxPosts) {
      try {
        const params: Record<string, any> = {
          tags,
          limit: unlimited ? 200 : Math.min(200, maxPosts - posts.length),
        };
        
        // Use b{id} pagination for unlimited fetching
        if (beforeId !== null) {
          params.page = `b${beforeId}`;
        }
        
        const response = await rateLimitedRequest(async () => {
          return danbooruClient.get('/posts.json', {
            params,
          });
        });
        
        // Check for null/undefined response (rate limit retry exhausted)
        if (!response?.data) {
          consecutiveFailures++;
          console.log(`[DANBOORU] Empty response for "${tags}" (failure ${consecutiveFailures}/${maxConsecutiveFailures})`);
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log(`[DANBOORU] Too many consecutive failures for "${tags}", stopping`);
            break;
          }
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Reset failure counter on success
        consecutiveFailures = 0;
        
        // No more posts
        if (response.data.length === 0) {
          console.log(`[DANBOORU] No more posts for "${tags}"`);
          break;
        }
        
        lastBatchSize = response.data.length;
        posts.push(...response.data);
        
        // Get the lowest ID for next page (posts are returned newest first)
        const lastPost = response.data[response.data.length - 1];
        const newBeforeId = lastPost.id;
        
        // Sanity check: make sure we're actually progressing
        if (beforeId !== null && newBeforeId >= beforeId) {
          console.error(`[DANBOORU] Pagination not progressing for "${tags}" (stuck at ID ${beforeId}), stopping`);
          break;
        }
        beforeId = newBeforeId;
        
        console.log(`[DANBOORU] Fetched batch for "${tags}" (${posts.length}/${unlimited ? '∞' : maxPosts} posts, next before ID: ${beforeId})`);
        
        // If we got fewer posts than requested, we've reached the end
        if (lastBatchSize < params.limit) {
          console.log(`[DANBOORU] Reached end of posts for "${tags}" (got ${lastBatchSize} < ${params.limit})`);
          break;
        }
      } catch (pageError: any) {
        consecutiveFailures++;
        
        // Handle specific HTTP errors
        if (pageError.response?.status === 410) {
          console.error(`[DANBOORU] 410 Gone for tags "${tags}"`);
          break;
        } else if (pageError.response?.status === 429 || pageError.response?.status === 421) {
          console.log(`[DANBOORU] Rate limited for "${tags}" (failure ${consecutiveFailures}/${maxConsecutiveFailures}), waiting...`);
          // Wait before retrying - the rate limiter should handle this but just in case
          await new Promise(resolve => setTimeout(resolve, 5000));
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log(`[DANBOORU] Too many rate limit errors for "${tags}", stopping with ${posts.length} posts`);
            break;
          }
          continue;
        } else if (pageError.response) {
          console.error(`[DANBOORU] HTTP ${pageError.response.status} for tags "${tags}"`);
          if (consecutiveFailures >= maxConsecutiveFailures) break;
          continue;
        } else {
          console.error(`[DANBOORU] Error for tags "${tags}":`, pageError.message);
          if (consecutiveFailures >= maxConsecutiveFailures) break;
          continue;
        }
      }
    }
    
    console.log(`[DANBOORU] Finished fetching "${tags}": ${posts.length} total posts`);
    return unlimited ? posts : posts.slice(0, limit);
  } catch (error: any) {
    console.error('[DANBOORU] Error fetching posts by tags:', error.message);
    return [];
  }
}

export async function fetchDanbooruPostsByArtist(
  artistTag: string,
  limit: number = 100
): Promise<DanbooruPost[]> {
  return fetchDanbooruPostsByTags(artistTag, limit);
}

export function mapDanbooruRating(rating: string): 'safe' | 'questionable' | 'explicit' {
  switch (rating) {
    case 's':
      return 'safe';
    case 'q':
      return 'questionable';
    case 'e':
      return 'explicit';
    default:
      return 'safe';
  }
}

export function extractDanbooruTags(post: DanbooruPost) {
  const tags: Array<{ name: string; type: 'general' | 'artist' | 'character' | 'copyright' | 'meta' }> = [];
  
  // Helper to normalize tag names (replace underscores with spaces)
  const normalizeName = (name: string) => name.replace(/_/g, ' ');
  
  // General tags
  if (post.tag_string_general) {
    post.tag_string_general.split(' ').forEach((tag) => {
      if (tag) tags.push({ name: normalizeName(tag), type: 'general' });
    });
  }
  
  // Character tags
  if (post.tag_string_character) {
    post.tag_string_character.split(' ').forEach((tag) => {
      if (tag) tags.push({ name: normalizeName(tag), type: 'character' });
    });
  }
  
  // Copyright tags
  if (post.tag_string_copyright) {
    post.tag_string_copyright.split(' ').forEach((tag) => {
      if (tag) tags.push({ name: normalizeName(tag), type: 'copyright' });
    });
  }
  
  // Artist tags
  if (post.tag_string_artist) {
    post.tag_string_artist.split(' ').forEach((tag) => {
      if (tag) tags.push({ name: normalizeName(tag), type: 'artist' });
    });
  }
  
  // Meta tags
  if (post.tag_string_meta) {
    post.tag_string_meta.split(' ').forEach((tag) => {
      if (tag) tags.push({ name: normalizeName(tag), type: 'meta' });
    });
  }
  
  return tags;
}

// AI-related tags on Danbooru (with underscores as they appear in the API)
const AI_TAGS = [
  'ai-generated',
  'ai-assisted',
  'ai_generated',
  'ai_assisted',
  'stable_diffusion',
  'midjourney',
  'novelai',
  'nai_diffusion',
  'dalle',
  'dall-e',
];

/**
 * Check if a Danbooru post has AI-related tags
 */
export function isAIPost(post: DanbooruPost): boolean {
  const metaTags = post.tag_string_meta?.toLowerCase() || '';
  const generalTags = post.tag_string_general?.toLowerCase() || '';
  const allTags = `${metaTags} ${generalTags}`;
  
  return AI_TAGS.some(aiTag => allTags.includes(aiTag.replace('-', '_')) || allTags.includes(aiTag.replace('_', '-')));
}
