import { query } from '@/lib/db';
import { listImages } from '@/lib/imageSearch';

// Public artist profile: the tag, the (possibly unclaimed) profile, review
// averages and a few recent safe works. Shared by GET /api/artists/:tag and
// the server render of /artist/:tag, so the page has its content in the HTML.
export async function getArtistProfile(tagName: string) {
  const normalized = tagName.toLowerCase().trim();
  const possibleNames = Array.from(new Set([
    normalized,
    normalized.replace(/ /g, '_'),
    normalized.replace(/_/g, ' '),
  ]));

  const tagResult = await query(
    `SELECT * FROM tags WHERE name = ANY($1) AND type = 'artist'`,
    [possibleNames]
  );

  if (tagResult.rows.length === 0) return null;

  const tag = tagResult.rows[0];

  const artistResult = await query(
    `SELECT * FROM artists WHERE tag_id = $1`,
    [tag.id]
  );

  const artist = artistResult.rows[0] || null;

  // Get reviews summary
  const reviewsResult = await query(
    `SELECT
      COUNT(*) as review_count,
      AVG((ratings->>'trust')::numeric) as avg_trust,
      AVG((ratings->>'quality')::numeric) as avg_quality,
      AVG((ratings->>'communication')::numeric) as avg_communication,
      AVG((ratings->>'pricing')::numeric) as avg_pricing
     FROM artist_reviews
     WHERE artist_tag_id = $1`,
    [tag.id]
  );

  const reviewSummary = reviewsResult.rows[0];

  // A few recent safe works for the profile page (the page always expected these)
  const recent = await listImages({
    page: 1, limit: 6, tags: [tag.name], ratings: ['safe'], sort: 'newest',
    aiOnly: false, hideAI: false, q: '', userId: null, username: null,
  }).catch(() => null);
  const sampleImages = recent && recent.success
    ? recent.images.map((img) => ({ _id: String(img.id), sequentialId: img.sequential_id, thumbnailUrl: img.thumbnail_url || img.url }))
    : [];

  return {
    success: true,
    tag: {
      _id: String(tag.id),
      id: tag.id,
      name: tag.name,
      type: tag.type,
      count: tag.count,
    },
    artist: artist ? {
      _id: String(artist.id),
      tagId: String(artist.tag_id),
      tagName: artist.tag_name,
      claimedByUserId: artist.claimed_by_user_id,
      claimedByUsername: artist.claimed_by_username,
      verified: artist.verified,
      avatarUrl: artist.avatar_url,
      bannerUrl: artist.banner_url,
      bio: artist.bio,
      socials: artist.socials || {},
      createdAt: artist.created_at,
    } : {
      // Nobody has claimed or edited this artist yet: an empty, unclaimed profile
      _id: '',
      tagId: String(tag.id),
      tagName: tag.name,
      claimedByUserId: null,
      claimedByUsername: null,
      verified: false,
      avatarUrl: '',
      bannerUrl: '',
      bio: '',
      socials: {},
      createdAt: tag.created_at,
      unclaimed: true,
    },
    sampleImages,
    imageCount: tag.count,
    reviews: {
      count: parseInt(reviewSummary?.review_count || '0'),
      averages: {
        trust: parseFloat(reviewSummary?.avg_trust || '0'),
        quality: parseFloat(reviewSummary?.avg_quality || '0'),
        communication: parseFloat(reviewSummary?.avg_communication || '0'),
        pricing: reviewSummary?.avg_pricing ? parseFloat(reviewSummary.avg_pricing) : null,
      },
    },
  };
}

export type ArtistProfile = NonNullable<Awaited<ReturnType<typeof getArtistProfile>>>;
