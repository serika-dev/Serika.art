import { Metadata } from 'next';
import RelatedPosts from '@/components/RelatedPosts';
import { resolveTags } from '@/lib/imageSearch';
import { normalizeTagName } from '@/lib/tagName';
import { displayTag } from '@/lib/seo';

interface Props {
  params: Promise<{ tagName: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tagName } = await params;
  const slug = normalizeTagName(decodeURIComponent(tagName));
  const decodedName = displayTag(slug);
  const { found } = await resolveTags([slug]).catch(() => ({ found: [] as { count: number }[] }));
  const count = found[0]?.count ?? 0;

  const title = `${decodedName} art${count > 0 ? ` (${count.toLocaleString()} illustrations)` : ''} | Serika.art`;
  const description = count > 0
    ? `${count.toLocaleString()} illustrations and fan art drawn by ${decodedName} on Serika.art. See their popular works, links, wiki and reviews.`
    : `Artist profile for ${decodedName} on Serika.art: illustrations, links, wiki and reviews.`;
  const keywords = [decodedName, `${decodedName} art`, `${decodedName} artist`, `${decodedName} illustrations`, `${decodedName} fan art`];

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: `https://serika.art/artist/${encodeURIComponent(slug)}`,
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
      type: 'profile',
      url: `https://serika.art/artist/${encodeURIComponent(slug)}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function ArtistLayout({ children, params }: Props) {
  const { tagName } = await params;
  const slug = normalizeTagName(decodeURIComponent(tagName));
  return (
    <>
      {children}
      {/* Server-rendered so the artist's work is in the HTML crawlers read */}
      <RelatedPosts post={{ sequentialId: -1, rating: 'safe' }} artist={slug} variant="artist" />
    </>
  );
}
