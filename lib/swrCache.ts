import { cacheGet, cacheSet } from '@/lib/db';

// Stale-while-revalidate for expensive JSON results: always answer from cache
// when there is something cached, and refresh it in the background once it is
// older than `freshSeconds`. Only the very first request ever waits.
const inflight = new Map<string, Promise<unknown>>();

export async function swrCached<T>(
  key: string,
  { freshSeconds, maxAgeSeconds }: { freshSeconds: number; maxAgeSeconds: number },
  load: () => Promise<T>
): Promise<T> {
  const refresh = () => {
    let pending = inflight.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = load()
        .then(async (value) => {
          await cacheSet(key, JSON.stringify({ at: Date.now(), value }), maxAgeSeconds);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    return pending;
  };

  const cached = await cacheGet(key);
  if (cached) {
    try {
      const { at, value } = JSON.parse(cached) as { at: number; value: T };
      if (Date.now() - at > freshSeconds * 1000) refresh().catch(() => {});
      return value;
    } catch {
      // fall through
    }
  }
  return refresh();
}
