'use client';

import { useEffect } from 'react';

const SRC = 'https://a.magsrv.com/ad-provider.js';

// ExoClick's ad-provider.js (60 KB, plus its own API calls) waits until the
// visitor does something or the page has been idle for a few seconds, so it
// never competes with the page's own content for bandwidth or the main thread.
// Ad slots wait for window.AdProvider (see ExoClickAd).
export default function AdScript() {
  useEffect(() => {
    let done = false;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      if (done) return;
      done = true;
      cleanup();
      if (document.querySelector(`script[src="${SRC}"]`)) return;
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
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
