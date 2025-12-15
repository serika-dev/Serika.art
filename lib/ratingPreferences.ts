// Cookie-based rating preferences management

export type Rating = 'safe' | 'questionable' | 'explicit';

const COOKIE_NAME = 'serika_ratings';
const DEFAULT_RATINGS: Rating[] = ['safe'];

// Get ratings from cookie
export function getRatingsFromCookie(): Rating[] {
  if (typeof document === 'undefined') return DEFAULT_RATINGS;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === COOKIE_NAME && value) {
      const ratings = decodeURIComponent(value).split(',').filter(Boolean) as Rating[];
      // Validate ratings
      const validRatings = ratings.filter(r => ['safe', 'questionable', 'explicit'].includes(r));
      return validRatings.length > 0 ? validRatings : DEFAULT_RATINGS;
    }
  }
  return DEFAULT_RATINGS;
}

// Set ratings cookie (expires in 1 year)
export function setRatingsCookie(ratings: Rating[]): void {
  if (typeof document === 'undefined') return;
  
  const validRatings = ratings.filter(r => ['safe', 'questionable', 'explicit'].includes(r));
  if (validRatings.length === 0) return;
  
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(validRatings.join(','))};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// Toggle a rating and return new ratings array
export function toggleRating(currentRatings: Rating[], rating: Rating): Rating[] {
  let newRatings: Rating[];
  
  if (currentRatings.includes(rating)) {
    newRatings = currentRatings.filter(r => r !== rating);
    // Must keep at least one rating
    if (newRatings.length === 0) {
      newRatings = currentRatings;
    }
  } else {
    newRatings = [...currentRatings, rating];
  }
  
  return newRatings;
}
