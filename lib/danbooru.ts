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
    const response = await danbooruClient.get(`/posts/${postId}.json`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Danbooru post:', error);
    return null;
  }
}

export async function fetchDanbooruPostsByArtist(
  artistTag: string,
  limit: number = 100
): Promise<DanbooruPost[]> {
  try {
    const posts: DanbooruPost[] = [];
    let page = 1;
    const hasAuth = !!DANBOORU_API_KEY;
    
    // With API key: 10 requests/second
    // Without API key: 1 request/second
    const rateLimit = hasAuth ? 100 : 1000;
    
    while (posts.length < limit) {
      const response = await danbooruClient.get('/posts.json', {
        params: {
          tags: artistTag,
          limit: Math.min(200, limit - posts.length),
          page,
        },
      });
      
      if (!response.data || response.data.length === 0) break;
      
      posts.push(...response.data);
      page++;
      
      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, rateLimit));
    }
    
    return posts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching Danbooru posts by artist:', error);
    return [];
  }
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
