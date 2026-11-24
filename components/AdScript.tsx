'use client';

import { useEffect } from 'react';

import { setAdScriptStatus } from '@/lib/adScriptStatus';

const SRC = 'https://a.magsrv.com/ad-provider.js';
/** A script still not loaded after this long is treated as blocked. */
const LOAD_TIMEOUT_MS = 10000;

// ExoClick's ad-provider.js (60 KB, plus its own API calls) waits until the
// visitor does something or the page has been idle for a few seconds, so it
// never competes with the page's own content for bandwidth or the main thread.
// Ad slots follow its load state (lib/adScriptStatus, see ExoClickAd): a
// blocked or failed script makes them show a Serika ad straight away.
export default function AdScript() {
  useEffect(() => {
    let done = false;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      if (done) return;
      done = true;
      cleanup();
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (existing) {
        // Already on the page (a remount, or Fast Refresh in dev)
        const state = existing.dataset.state;
        if (state === 'ready' || state === 'failed') setAdScriptStatus(state);
        return;
      }
      setAdScriptStatus('loading');
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
      script.onload = () => {
        script.dataset.state = 'ready';
        setAdScriptStatus('ready');
      };
      script.onerror = () => {
        script.dataset.state = 'failed';
        setAdScriptStatus('failed');
      };
      setTimeout(() => setAdScriptStatus('failed'), LOAD_TIMEOUT_MS);
      document.body.appendChild(script);
    };
    const cleanup = () => {
      events.forEach((e) => window.removeEventListener(e, load));
      window.removeEventListener('load', onLoad);
      if (timer) clearTimeout(timer);
    };
    const onLoad = () => {
      timer = setTimeout(load, 3000);
    };

    events.forEach((e) => window.addEventListener(e, load, { once: true, passive: true }));
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return cleanup;
  }, []);

  return null;
}
