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

export function ratingMongoFilter(ratings: string[]) {
  const normalizedRatings = normalizeRatings(ratings);

  if (normalizedRatings.length === VALID_RATINGS.length) {
    return undefined;
  }

  return { $in: normalizedRatings };
}

export function publicImageMongoFilter() {
  return {
    deleted: { $ne: true },
  };
}
