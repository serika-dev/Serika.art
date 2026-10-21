// Builds the /api/images query string for the posts grid. Shared by the client
// (PostsPageClient) and the server-rendered first page (app/posts/page.tsx) so
// the server can tell whether the data it rendered matches what the client
// would have fetched.

export const DEFAULT_POSTS_PER_PAGE = 24;
export const RATINGS_COOKIE = 'serika_ratings';

export function buildImagesQuery({
  page,
  limit,
  sort,
  tags,
  ratings,
  hideAI,
  uploader,
}: {
  page: number;
  limit: number;
  sort: string;
  tags: string[];
  ratings: string[];
  hideAI: boolean;
  uploader: string;
}): string {
  const tagsParam = tags.length ? `&tags=${tags.map((t) => encodeURIComponent(t)).join(',')}` : '';
  const hideAIParam = hideAI ? '&hideAI=true' : '';
  const uploaderParam = uploader ? `&username=${encodeURIComponent(uploader)}` : '';
  return `page=${page}&limit=${limit}&sort=${sort}${tagsParam}&ratings=${ratings.join(',')}${hideAIParam}${uploaderParam}`;
}

/** Same parsing as lib/ratingPreferences getRatingsFromCookie, for a raw cookie value. */
export function parseRatingsCookie(value: string | undefined): string[] {
  if (!value) return ['safe'];
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // keep raw
  }
  const valid = decoded.split(',').filter((r) => ['safe', 'questionable', 'explicit'].includes(r));
  return valid.length > 0 ? valid : ['safe'];
}
