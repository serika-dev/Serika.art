import { Metadata } from 'next';
import { cookies } from 'next/headers';
import PostsPageClient from '@/components/PostsPageClient';
import { listImages, parseImageListParams } from '@/lib/imageSearch';
import { buildImagesQuery, parseRatingsCookie, DEFAULT_POSTS_PER_PAGE, RATINGS_COOKIE } from '@/lib/postsQuery';

// Don't hold the HTML back for a slow listing – the client fetches it instead
// (by then the server-side query has usually warmed the cache).
const INITIAL_DATA_BUDGET_MS = 800;

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const tags = params.tags as string | undefined;
  const page = params.page as string | undefined;
  
  let title = 'Browse Artwork | Serika.art - 1.5M+ Images';
  let description = 'Discover over 1.5 million artworks on Serika.art. Filter by tags, ratings, artists, characters & more.';
  let canonicalUrl = 'https://serika.art/posts';

  const keywords: string[] = [
    'anime art', 'illustrations', 'digital art', 'art gallery', 'image board',
    'booru', 'fan art', 'anime wallpapers', 'manga art', 'serika.art',
  ];

  if (tags) {
    const tagList = tags.split(',').map(t => t.trim());
    const displayTags = tagList.map(t => t.replace(/_/g, ' ')).join(', ');
    title = `${displayTags} | Serika.art - Art & Illustrations`;
    description = `Browse ${displayTags} artworks on Serika.art. Explore high-quality illustrations, fan art, and digital art from our collection of 1.5M+ images.`;
    canonicalUrl = `https://serika.art/posts?tags=${encodeURIComponent(tags)}`;
    
    // Add tag-derived keywords
    tagList.forEach(t => {
      keywords.push(t, `${t} art`, `${t} fan art`, `${t} illustration`, `${t} wallpaper`);
    });
  } else if (page) {
    title = `Browse Artwork - Page ${page} | Serika.art`;
    canonicalUrl = `https://serika.art/posts?page=${page}`;
  }

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
