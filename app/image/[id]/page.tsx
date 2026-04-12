import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollection } from '@/lib/db';
import ImageDetailContent from '@/components/ImageDetailContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getImageData(id: string) {
  const collection = await getCollection('images');
  const tagsCollection = await getCollection('tags');
  
  const sequentialId = parseInt(id, 10);
  if (isNaN(sequentialId)) return null;

  const image = await collection.findOne({ sequentialId });
  if (!image) return null;

  // Populate tags
  const tags = image.tags || [];
  let populatedTags: any[] = [];
  
  if (Array.isArray(tags) && tags.length > 0) {
    const tagDocs = await tagsCollection
      .find({ _id: { $in: tags } })
      .toArray();
    
    const tagMap = new Map(tagDocs.map(t => [t._id.toString(), t]));
    
    populatedTags = tags.map(tagId => {
      const tag = tagMap.get(tagId.toString());
      return {
        _id: tagId.toString(),
        name: tag?.name || 'unknown',
        type: tag?.type || 'general',
      };
    });
  }

  // Increment views in background (non-blocking for initial render)
  collection.updateOne({ sequentialId }, { $inc: { views: 1 } }).catch(console.error);

  // Serialize for Client Component
  return JSON.parse(JSON.stringify({
    ...image,
    _id: image._id.toString(),
    userId: image.userId?.toString(),
    tags: populatedTags,
    views: image.views + 1
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const image = await getImageData(id);
  
  if (!image) {
    return {
      title: 'Image Not Found | Serika.art',
      robots: { index: false, follow: true },
    };
  }

  const tagNames = image.tags.map((t: any) => t.name);
  const artistTags = image.tags.filter((t: any) => t.type === 'artist').map((t: any) => t.name);
  const characterTags = image.tags.filter((t: any) => t.type === 'character').map((t: any) => t.name);
  const copyrightTags = image.tags.filter((t: any) => t.type === 'copyright').map((t: any) => t.name);
  
  const tags = tagNames.join(', ');
  const artistStr = artistTags.length > 0 ? ` by ${artistTags.join(', ')}` : '';
  const charStr = characterTags.length > 0 ? ` featuring ${characterTags.join(', ')}` : '';
  const seriesStr = copyrightTags.length > 0 ? ` from ${copyrightTags.join(', ')}` : '';
  
  const title = `${artistStr ? artistTags[0] + ' - ' : ''}${characterTags[0] || 'Artwork'} #${image.sequentialId}${seriesStr} | Serika.art`;
  const description = `High-quality artwork${artistStr}${charStr}${seriesStr}. ${image.width}x${image.height}, ${image.rating} rated. Tags: ${tags}. Discover 1.5M+ artworks on Serika.art.`;
  
  // Build expanded keywords: original tags + variants
  const keywords: string[] = [
    ...tagNames,
    ...artistTags.map((a: string) => `${a} art`),
    ...characterTags.map((c: string) => `${c} fan art`),
    ...copyrightTags.map((c: string) => `${c} fan art`),
    'anime art', 'illustration', 'digital art', 'fan art', 'serika.art',
  ];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `https://serika.art/image/${id}`,
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
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: tags,
        },
      ],
      type: 'article',
      url: `https://serika.art/image/${id}`,
      siteName: 'Serika.art',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function ImagePage({ params }: PageProps) {
  const { id } = await params;
  const image = await getImageData(id);

  if (!image) {
    notFound();
  }

  const artistTags = image.tags.filter((t: any) => t.type === 'artist').map((t: any) => t.name);
  const copyrightTags = image.tags.filter((t: any) => t.type === 'copyright').map((t: any) => t.name);
  
  // Structured Data for Google Images & Rich Results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `https://serika.art/image/${image.sequentialId}`,
    name: `Artwork #${image.sequentialId}${artistTags.length > 0 ? ` by ${artistTags[0]}` : ''}`,
    description: image.description || `Illustration shared on Serika.art with tags: ${image.tags.map((t: any) => t.name).join(', ')}`,
    contentUrl: image.url,
    url: `https://serika.art/image/${image.sequentialId}`,
    thumbnailUrl: image.thumbnailUrl || image.url,
    width: { '@type': 'QuantitativeValue', value: image.width, unitCode: 'E37' },
    height: { '@type': 'QuantitativeValue', value: image.height, unitCode: 'E37' },
    uploadDate: image.createdAt,
    datePublished: image.createdAt,
    author: {
      '@type': 'Person',
      name: image.username,
      url: `https://serika.art/user/${encodeURIComponent(image.username.trim())}`,
    },
    ...(artistTags.length > 0 && {
      creator: artistTags.map((a: string) => ({
        '@type': 'Person',
        name: a.replace(/_/g, ' '),
        url: `https://serika.art/artist/${encodeURIComponent(a)}`,
      })),
    }),
    ...(copyrightTags.length > 0 && {
      copyrightHolder: copyrightTags.map((c: string) => ({
        '@type': 'Organization',
        name: c.replace(/_/g, ' '),
      })),
    }),
    keywords: image.tags.map((t: any) => t.name).join(', '),
    genre: 'Illustration',
    contentRating: image.rating,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Serika.art',
      url: 'https://serika.art',
    },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: image.views,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: image.favorites,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ImageDetailContent initialImage={image} imageId={id} />
    </>
  );
}
