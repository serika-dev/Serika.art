import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tagging Guidelines',
  description: 'How to tag posts on Serika.art: the minimum, the five tag types, naming rules, ratings and how the autotagger fits in.',
  alternates: { canonical: 'https://serika.art/guidelines/tagging' },
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'minimum',
    title: 'Every post needs at least 5 tags',
    body: (
      <>
        <p>
          Uploads with fewer than five tags are refused. Five is the floor, not the goal: a typical good post has
          15–40 tags. More accurate tags means more people find the art.
        </p>
        <p>
          Every post is also run through the autotagger after upload, which adds tags it is confident about. It only
          ever adds tags, it never removes yours.
        </p>
      </>
    ),
  },
  {
    id: 'types',
    title: 'The five tag types',
    body: (
      <ul>
        <li><strong className="text-red-400">Artist</strong> – who drew it, e.g. <code>azunyan</code>. Add it whenever you know it. Never your own username unless you drew it.</li>
        <li><strong className="text-purple-400">Copyright</strong> – the series, game or franchise, e.g. <code>blue_archive</code>, <code>vocaloid</code>. Use <code>original</code> for original characters.</li>
        <li><strong className="text-green-400">Character</strong> – each recognisable character, e.g. <code>hatsune_miku</code>. One tag per character shown.</li>
        <li><strong className="text-blue-400">General</strong> – what is visible: people count (<code>1girl</code>, <code>2boys</code>, <code>solo</code>), hair, eyes, clothing, pose, expression, objects, background.</li>
        <li><strong className="text-yellow-400">Meta</strong> – facts about the file, not the picture: <code>highres</code>, <code>absurdres</code>, <code>comic</code>, <code>sketch</code>, <code>animated</code>, <code>translated</code>.</li>
      </ul>
    ),
  },
  {
    id: 'naming',
    title: 'How to write a tag',
    body: (
      <ul>
        <li>Lowercase English, words joined with underscores: <code>long_hair</code>, <code>looking_at_viewer</code>. Spaces are accepted and mean the same tag.</li>
        <li>Use the Danbooru name when one exists. Pick from the suggestions while typing rather than inventing a spelling.</li>
        <li>Characters as <code>given_family</code> in the series&apos; usual romanisation; add a series qualifier only when names clash, e.g. <code>sakura_(cardcaptor_sakura)</code>.</li>
        <li>One concept per tag. No sentences, no hashtags, no emoji.</li>
      </ul>
    ),
  },
  {
    id: 'what',
    title: 'Tag what you see',
    body: (
      <ul>
        <li>Describe the image, not the story behind it. If you can&apos;t see it, don&apos;t tag it.</li>
        <li>Be specific and also general: <code>pleated_skirt</code> and <code>skirt</code>, <code>red_eyes</code> together with the hair colour.</li>
        <li>Count people: <code>1girl</code>, <code>2girls</code>, <code>1boy</code>, <code>multiple_girls</code>, <code>no_humans</code>; add <code>solo</code> when only one person is shown.</li>
        <li>No opinions or quality judgements (<code>beautiful</code>, <code>best_art</code>, <code>cute</code>), no usernames, no &quot;tagme&quot;.</li>
        <li>Don&apos;t tag the same thing twice under different spellings.</li>
      </ul>
    ),
  },
  {
    id: 'ratings',
    title: 'Ratings',
    body: (
      <ul>
        <li><strong className="text-emerald-400">Safe</strong> – nothing you couldn&apos;t show in public. Includes Danbooru&apos;s general and sensitive.</li>
        <li><strong className="text-amber-400">Questionable</strong> – suggestive: underwear focus, partial nudity, sexual themes without explicit content.</li>
        <li><strong className="text-rose-400">Explicit</strong> – nudity of genitals, sexual acts, or anything graphic.</li>
        <li>When in doubt, pick the stricter rating. Mis-rated posts are moderated.</li>
      </ul>
    ),
  },
  {
    id: 'ai',
    title: 'AI-generated images',
    body: (
      <p>
        Tick <strong>AI Generated</strong> when an image was made or substantially edited with an image generator.
        People can hide AI posts, so leaving it unticked is treated like a wrong rating.
      </p>
    ),
  },
  {
    id: 'autotagger',
    title: 'Using the suggested tags',
    body: (
      <>
        <p>
          When you pick an image on the upload page, the autotagger suggests tags with a confidence score. The
          confident ones can be added with one click; dashed ones are guesses. Check them: it can miss things,
          misread a character, or describe a detail that is not there.
        </p>
        <p>
          It also suggests a rating, and will raise the rating on its own if your image looks more explicit than the
          rating you have selected. You always have the final say.
        </p>
        <p>
          Developers can call it too: see <Link href="/api-docs" className="underline">POST /api/v1/autotag</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'sources',
    title: 'Sources and reposts',
    body: (
      <p>
        Add the original source URL (Pixiv, X, the artist&apos;s site) whenever you can, and the artist tag with it.
        Don&apos;t upload art whose artist has asked for it not to be reposted. Rights holders can file a{' '}
        <Link href="/dmca" className="underline">DMCA notice</Link>.
      </p>
    ),
  },
];

export default function TaggingGuidelinesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-black tracking-tight mb-3">Tagging Guidelines</h1>
      <p className="text-muted-foreground mb-8">
        Good tags are how people find art on Serika.art. These rules apply to every upload, on the site and through the API.
      </p>

      <nav className="mb-10 rounded-2xl border border-border/50 bg-card/50 p-4">
        <ol className="grid gap-1 sm:grid-cols-2 text-sm">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{i + 1}. {s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-10">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold mb-3">{s.title}</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-foreground/85 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
