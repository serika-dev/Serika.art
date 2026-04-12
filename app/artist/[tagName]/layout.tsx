import { Metadata } from 'next';

interface Props {
  params: Promise<{ tagName: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tagName } = await params;
  const decodedName = decodeURIComponent(tagName).replace(/_/g, ' ');

  const title = `${decodedName} | Artist Profile | Serika.art`;
  const description = `View the artist profile for ${decodedName} on Serika.art. Explore their illustrations, fan art, and digital creations among our 1.5M+ image collection.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://serika.art/artist/${tagName}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function ArtistLayout({ children }: Props) {
  return children;
}
