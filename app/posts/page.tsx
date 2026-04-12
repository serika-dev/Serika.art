import { Metadata } from 'next';
import PostsPageClient from '@/components/PostsPageClient';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const tags = params.tags as string | undefined;
  const page = params.page as string | undefined;
  
  let title = 'Browse Artwork | Serika.art - 1.5M+ Images';
  let description = 'Discover over 1.5 million artworks on Serika.art. Filter by tags, ratings, artists, characters & more.';

  if (tags) {
    const tagList = tags.split(',').join(', ');
    title = `${tagList} | Search Serika.art`;
    description = `Explore artworks tagged with ${tagList} on Serika.art. Browse through over 1.5 million high-quality illustrations and digital art.`;
  } else if (page) {
    title = `Browse Artwork - Page ${page} | Serika.art`;
  }

  return {
    title,
    description,
    keywords: tags ? tags.split(',') : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      url: 'https://serika.art/posts',
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function PostsPage() {
  return <PostsPageClient />;
}
