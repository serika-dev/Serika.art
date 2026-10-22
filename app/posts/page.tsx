import { Metadata } from 'next';
import { jsonLdHtml } from '@/lib/jsonLd';
import { cookies } from 'next/headers';
import PostsPageClient from '@/components/PostsPageClient';
import { listImages, parseImageListParams, resolveTags } from '@/lib/imageSearch';
import { query } from '@/lib/db';
import { displayTag } from '@/lib/seo';
import { buildImagesQuery, parseRatingsCookie, DEFAULT_POSTS_PER_PAGE, RATINGS_COOKIE } from '@/lib/postsQuery';

// Don't hold the HTML back for a slow listing – the client fetches it instead
// (by then the server-side query has usually warmed the cache).
const INITIAL_DATA_BUDGET_MS = 800;

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const TYPE_PHRASE: Record<string, string> = {
  artist: 'art',
  character: 'art & images',
  copyright: 'art & fan art',
  meta: 'images',
  general: 'anime art',
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const tagsParam = first(params.tags).trim();
  const page = Math.max(1, parseInt(first(params.page) || '1', 10) || 1);
  const pageSuffix = page > 1 ? ` – page ${page}` : '';

  const tagList = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const included = tagList.filter((t) => !t.startsWith('-'));

  // Only clean single-tag pages (and plain /posts) are worth indexing; tag
  // combinations, exclusions, sorts and uploader filters are endless
  // near-duplicates that would eat the crawl budget.
  const indexable =
    included.length <= 1 &&
    included.length === tagList.length &&
    !first(params.sort) &&
    !first(params.uploader) &&
    page <= 50;

  let title = `Anime Art & Illustrations${pageSuffix} | Serika.art`;
  let description =
    'Browse millions of anime artworks, illustrations and fan art on Serika.art, tagged by artist, character, series and more.';
  let canonicalUrl = `https://serika.art/posts${page > 1 ? `?page=${page}` : ''}`;
  let exists = true;

  if (included.length > 0) {
    const names = included.map(displayTag);
    const { found } = await resolveTags(included).catch(() => ({ found: [] as { name: string; count: number; type?: string }[] }));
    const main = found[0] as { name: string; count: number; type?: string } | undefined;
    exists = found.length === included.length;
    const count = main?.count ?? 0;
    const type = (main && (await tagType(main.name))) || 'general';

    const subject = names.join(' + ');
    const Subject = subject.replace(/\b\w/g, (c) => c.toUpperCase());
    title = `${Subject} ${TYPE_PHRASE[type] ?? 'art'}${count > 0 && included.length === 1 ? ` (${count.toLocaleString()})` : ''}${pageSuffix} | Serika.art`;
    description =
      included.length === 1 && count > 0
        ? `Browse ${count.toLocaleString()} ${subject} images on Serika.art${type === 'artist' ? `: illustrations and fan art drawn by ${subject}` : type === 'character' ? `: fan art and illustrations of ${subject}` : type === 'copyright' ? `: fan art of ${subject} characters` : ''}. Sorted by newest, filter by rating and tags.`
        : `Browse ${subject} images on Serika.art – anime art and illustrations tagged ${names.join(' and ')}.`;
    canonicalUrl = `https://serika.art/posts?tags=${encodeURIComponent(included.join(','))}${page > 1 ? `&page=${page}` : ''}`;
  }

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl },
    robots: {
      index: indexable && exists,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    openGraph: { title, description, type: 'website', url: canonicalUrl, siteName: 'Serika.art' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

async function tagType(name: string): Promise<string | null> {
  const r = await query<{ type: string }>(`SELECT type FROM tags WHERE name = $1`, [name]).catch(() => null);
  return r?.rows[0]?.type ?? null;
}

async function getInitialPosts(params: { [key: string]: string | string[] | undefined }) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const cookieStore = await cookies();

  // Mirror the client's first request (default per-page/AI settings; the
  // client refetches if its local settings differ).
  const initialQuery = buildImagesQuery({
    page: parseInt(first(params.page) || '1', 10) || 1,
    limit: DEFAULT_POSTS_PER_PAGE,
    sort: first(params.sort) || 'newest',
    tags: first(params.tags) ? first(params.tags).split(',').map((t) => t.trim()) : [],
    ratings: parseRatingsCookie(cookieStore.get(RATINGS_COOKIE)?.value),
    hideAI: false,
    uploader: first(params.uploader),
  });
  if (initialQuery.includes('sort=random')) return null;

  try {
    const pending = listImages(parseImageListParams(new URLSearchParams(initialQuery)));
    pending.catch(() => {});
    const result = await Promise.race([
      pending,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), INITIAL_DATA_BUDGET_MS)),
    ]);
    if (!result || !result.success) return null;
    return { initialQuery, initialData: { images: result.images, pagination: result.pagination } };
  } catch (error) {
    console.error('Error pre-rendering posts:', error);
    return null;
  }
}

export default async function PostsPage({ searchParams }: Props) {
  const initial = await getInitialPosts(await searchParams);

  // We render CollectionPage JSON-LD inline for tag-based searches
  return (
    <>
      <PostsSearchStructuredData searchParams={searchParams} />
      <PostsPageClient initialQuery={initial?.initialQuery} initialData={initial?.initialData} />
    </>
  );
}

async function PostsSearchStructuredData({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const tags = params.tags as string | undefined;
  
  if (!tags) return null;
  
  const tagList = tags.split(',').map(t => t.trim());
  const displayTags = tagList.map(t => t.replace(/_/g, ' ')).join(', ');
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${displayTags} - Art Collection`,
    description: `Browse ${displayTags} artworks on Serika.art`,
    url: `https://serika.art/posts?tags=${encodeURIComponent(tags)}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Serika.art',
      url: 'https://serika.art',
    },
    about: tagList.map(tag => ({
      '@type': 'Thing',
      name: tag.replace(/_/g, ' '),
    })),
    provider: {
      '@type': 'Organization',
      name: 'Serika.art',
      url: 'https://serika.art',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
    />
  );
}
