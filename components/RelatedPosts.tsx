import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { listImages } from '@/lib/imageSearch';
import { displayTag, postHeadline } from '@/lib/seo';

// Server-rendered "more by this artist / of this character" strips under a
// post. Besides being useful, they are the crawl paths between posts that
// boorus rank with: every post links to its neighbours and its tag pages.

interface Props {
  post: { sequentialId: number; rating: string };
  artist?: string;
  character?: string;
  series?: string;
  /** "artist": a bigger "Popular works by …" grid for artist pages */
  variant?: 'post' | 'artist';
}

async function section(tag: string, post: Props['post'], perSection: number) {
  // Safe posts only suggest safe posts; NSFW posts may show all ratings
  const ratings = post.rating === 'safe' ? ['safe'] : ['safe', 'questionable', 'explicit'];
  const result = await listImages({
    page: 1,
    limit: perSection + 1,
    tags: [tag],
    ratings,
    sort: 'popular',
    aiOnly: false,
    hideAI: false,
    q: '',
    userId: null,
    username: null,
  });
  if (!result.success) return null;
  const images = result.images.filter((img) => img.sequential_id !== post.sequentialId).slice(0, perSection);
  return images.length >= 3 ? { tag, total: result.pagination.total, images } : null;
}

export default async function RelatedPosts({ post, artist, character, series, variant = 'post' }: Props) {
  const perSection = variant === 'artist' ? 24 : 12;
  try {
    const picks = [
      artist && { tag: artist, label: (t: string) => (variant === 'artist' ? `Popular works by ${t}` : `More by ${t}`) },
      character && { tag: character, label: (t: string) => `More of ${t}` },
      !character && series && { tag: series, label: (t: string) => `More from ${t}` },
    ].filter(Boolean) as { tag: string; label: (t: string) => string }[];

    const sections = (
      await Promise.all(picks.map(async (p) => ({ ...p, data: await section(p.tag, post, perSection) })))
    ).filter((s) => s.data);
    if (sections.length === 0) return null;

    return (
      <div className="mx-auto max-w-7xl space-y-10 px-4 pb-12 sm:px-6 lg:px-8">
        {sections.map(({ tag, label, data }) => (
          <section key={tag} aria-labelledby={`related-${tag}`}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 id={`related-${tag}`} className="text-lg font-bold capitalize">{label(displayTag(tag))}</h2>
              <Link
                href={`/posts?tags=${encodeURIComponent(tag)}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                All {data!.total.toLocaleString()} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {data!.images.map((img) => {
                const alt = postHeadline(img.tags);
                return (
                  <li key={img.sequential_id}>
                    <Link
                      href={`/image/${img.sequential_id}`}
                      title={alt}
                      className="block aspect-square overflow-hidden rounded-xl border border-border/40 bg-muted transition-colors hover:border-primary/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.thumbnail_url || img.url}
                        alt={alt}
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={320}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  } catch (error) {
    console.error('Related posts failed:', error);
    return null;
  }
}
