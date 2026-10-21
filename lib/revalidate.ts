import { revalidatePath } from 'next/cache';

const SITE_URL = 'https://serika.art';
// Optional: lets edits/takedowns also drop Cloudflare's copy of the page
// right away instead of waiting out its s-maxage. Needs "Cache Purge" permission.
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || '';
const CF_PURGE_TOKEN = process.env.CLOUDFLARE_PURGE_TOKEN || '';

/** Drop the cached (ISR) image page so the next visit re-renders it. */
export function revalidateImagePage(sequentialId: number | string | null | undefined) {
  if (sequentialId === null || sequentialId === undefined) return;
  const path = `/image/${sequentialId}`;
  try {
    revalidatePath(path);
  } catch (err) {
    console.error('[revalidate] Failed to revalidate image page', sequentialId, err);
  }
  purgeEdge([`${SITE_URL}${path}`]);
}

function purgeEdge(files: string[]) {
  if (!CF_ZONE_ID || !CF_PURGE_TOKEN) return;
  fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_PURGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
    signal: AbortSignal.timeout(5000),
  })
    .then(async (res) => {
      if (!res.ok) console.error('[revalidate] Cloudflare purge failed:', res.status, await res.text());
    })
    .catch((err) => console.error('[revalidate] Cloudflare purge failed:', err?.message || err));
}
