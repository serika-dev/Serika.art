// Search-facing text for posts and tag pages, in the style that ranks for
// booru searches ("<character> (<series>) drawn by <artist>").

export const SITE_NAME = 'Serika.art';
export const SITE_URL = 'https://serika.art';

/** Tag names are stored Danbooru-style; people search with spaces. */
export function displayTag(name: string): string {
  return name.replace(/_/g, ' ').trim();
}

interface TagLike {
  name: string;
  type: string;
}

function list(names: string[], max: number): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,\s]+$/, '')}…`;
}

const RATING_LABEL: Record<string, string> = { safe: 'safe', questionable: 'questionable', explicit: 'explicit' };

/** Booru-style headline: "hatsune miku (vocaloid) drawn by kuroi". */
export function postHeadline(tags: TagLike[]): string {
  const of = (type: string) => tags.filter((t) => t.type === type).map((t) => displayTag(t.name));
  const characters = of('character');
  const series = of('copyright');
  const artists = of('artist');

  let subject = '';
  if (characters.length) {
    subject = list(characters, 3);
    if (series.length) subject += ` (${list(series, 2)})`;
  } else if (series.length) {
    subject = list(series, 2);
  } else {
    const general = of('general').filter((t) => !/^(\d+(girl|boy)s?|solo|highres|absurdres)$/.test(t.replace(/ /g, '_')));
    subject = general.slice(0, 3).join(', ') || 'Artwork';
  }
  return artists.length ? `${subject} drawn by ${list(artists, 2)}` : subject;
}

export function postSeo(post: { sequentialId: number; width: number; height: number; rating: string; tags: TagLike[] }) {
  const headline = postHeadline(post.tags);
  const general = post.tags.filter((t) => t.type === 'general').map((t) => displayTag(t.name));

  const title = `${clip(headline, 80)} | ${SITE_NAME}`;
  const description = clip(
    `${headline.charAt(0).toUpperCase()}${headline.slice(1)}. ${general.slice(0, 10).join(', ')}${general.length ? '. ' : ''}` +
      `${post.width}×${post.height} ${RATING_LABEL[post.rating] ?? ''} image #${post.sequentialId} on ${SITE_NAME}.`,
    160
  );
  // Image alt text: what's in the picture, not a raw tag dump
  const alt = clip(`${headline}${general.length ? ` – ${general.slice(0, 12).join(', ')}` : ''}`, 250);
  return { headline, title, description, alt, isAdult: post.rating !== 'safe' };
}

/** og:image that social sites and crawlers can actually fetch: a ~1200px resize instead of a multi-MB original. */
export function shareImageUrl(url: string, width = 1200): string {
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
