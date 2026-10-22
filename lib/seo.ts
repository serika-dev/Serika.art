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

export function postSeo(post: {
  sequentialId: number;
  width: number;
  height: number;
  rating: string;
  createdAt?: string | Date | null;
  tags: TagLike[];
}) {
  const headline = postHeadline(post.tags);
  const general = post.tags.filter((t) => t.type === 'general').map((t) => displayTag(t.name));

  const title = `${clip(headline, 80)} | ${SITE_NAME}`;
  const summary = postSummary(post);
  const description = clip(summary, 160);
  // Image alt text: what's in the picture, not a raw tag dump
  const alt = clip(`${headline}${general.length ? ` – ${general.slice(0, 12).join(', ')}` : ''}`, 250);
  return { headline, title, summary, description, alt, isAdult: post.rating !== 'safe' };
}

const META_GENERAL = /^(\d+(girl|boy|other)s?|solo|solo_focus|highres|absurdres|lowres|commentary.*|translated|.*_request|bad_.*|signature|watermark|artist_name|dated)$/;

/**
 * One or two plain sentences that say what the post is. Booru pages are
 * otherwise nothing but a picture and a tag list; this is the unique,
 * readable text that gives Google a reason to index each post on its own.
 */
export function postSummary(post: {
  width: number;
  height: number;
  rating: string;
  createdAt?: string | Date | null;
  tags: TagLike[];
}): string {
  const of = (type: string) => post.tags.filter((t) => t.type === type).map((t) => displayTag(t.name));
  const characters = of('character');
  const series = of('copyright').filter((s) => s !== 'original');
  const artists = of('artist');
  const general = post.tags
    .filter((t) => t.type === 'general' && !META_GENERAL.test(t.name.replace(/ /g, '_')))
    .map((t) => displayTag(t.name));

  let subject: string;
  if (characters.length) subject = `Fan art of ${list(characters, 3)}${series.length ? ` from ${list(series, 2)}` : ''}`;
  else if (series.length) subject = `${list(series, 2)} fan art`;
  else if (post.tags.some((t) => t.name === 'original')) subject = 'Original artwork';
  else subject = 'Artwork';
  if (artists.length) subject += `, drawn by ${list(artists, 2)}`;

  const big = Math.max(post.width, post.height) >= 1600;
  const shape = post.width > post.height * 1.15 ? 'landscape' : post.height > post.width * 1.15 ? 'portrait' : 'square';
  const shown = general.slice(0, 12);
  const features = shown.length
    ? ` features ${shown.join(', ')}${general.length > shown.length ? ` and ${general.length - shown.length} more tags` : ''}`
    : '';

  const date = post.createdAt ? new Date(post.createdAt) : null;
  const when =
    date && !isNaN(date.getTime())
      ? `, posted ${date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })}`
      : '';

  return (
    `${subject.charAt(0).toUpperCase()}${subject.slice(1)}. ` +
    `This ${post.width}×${post.height} ${big ? 'high-resolution ' : ''}${shape} illustration${features}. ` +
    `Rated ${RATING_LABEL[post.rating] ?? post.rating}${when}.`
  );
}

/** og:image that social sites and crawlers can actually fetch: a ~1200px resize instead of a multi-MB original. */
export function shareImageUrl(url: string, width = 1200): string {
  return `${SITE_URL}/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
