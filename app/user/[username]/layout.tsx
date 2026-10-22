import { Metadata } from 'next';
import { uploadCountFor } from '@/lib/userDirectory';

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decodedName = decodeURIComponent(username);
  const uploads = await uploadCountFor(decodedName).catch(() => 0);

  const title = `${decodedName}${uploads > 0 ? ` – ${uploads.toLocaleString()} uploads` : ''} | Serika.art`;
  const description = uploads > 0
    ? `${uploads.toLocaleString()} artworks uploaded by ${decodedName} on Serika.art, plus their favorites and activity.`
    : `${decodedName}'s profile on Serika.art.`;
  const keywords = [
    decodedName, `${decodedName} profile`, `${decodedName} art uploads`,
    'art community', 'serika artist', 'art uploader', 'serika.art',
  ];

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: `https://serika.art/user/${username}`,
    },
    // Only profiles with uploads are worth indexing (empty ones are thin pages;
    // the shared "Anonymous" account would just duplicate /posts)
    robots: {
      index: uploads > 0,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://serika.art/user/${username}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function UserLayout({ children }: Props) {
  return children;
}
