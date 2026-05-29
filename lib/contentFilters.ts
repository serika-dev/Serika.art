export const VALID_RATINGS = ['safe', 'questionable', 'explicit'] as const;

export type Rating = (typeof VALID_RATINGS)[number];

export const DEFAULT_RATINGS: Rating[] = ['safe'];

const validRatingSet = new Set<string>(VALID_RATINGS);

export function normalizeRatings(
  ratings: string[],
  fallback: Rating[] = DEFAULT_RATINGS
): Rating[] {
  const validRatings = ratings.filter((rating): rating is Rating =>
    validRatingSet.has(rating)
  );

  return validRatings.length > 0 ? validRatings : fallback;
}

/**
 * Build a SQL WHERE fragment for rating filtering.
 * Returns { clause: string; params: any[] } or null if no filter needed.
 */
export function ratingFilter(
  ratings: string[],
  paramOffset: number = 1
): { clause: string; params: any[] } | null {
  const normalizedRatings = normalizeRatings(ratings);

  if (normalizedRatings.length === VALID_RATINGS.length) {
    return null; // no filter needed
  }

  const placeholders = normalizedRatings.map(
    (_, i) => `$${paramOffset + i}`
  );
  return {
    clause: `rating = ANY(ARRAY[${placeholders.join(',')}])`,
    params: normalizedRatings,
  };
}

/**
 * SQL WHERE fragment for public (non-deleted, non-unlisted) images.
 */
export function publicImageFilter(): string {
  return `deleted = FALSE AND unlisted = FALSE`;
}
