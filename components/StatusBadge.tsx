'use client';

import { useEffect, useState } from 'react';

/**
 * Better Stack's badge HTML, loaded through /api/status-badge.
 * A direct iframe is cross-origin, and Chrome paints a white canvas over its
 * white text whenever this page is color-scheme: dark. theme follows the
 * page's `dark` class.
 */
export default function StatusBadge() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const theme = dark ? 'dark' : 'light';

  return (
    <iframe
      src={`/api/status-badge?theme=${theme}`}
      title="Serika status"
      width={250}
      height={30}
      scrolling="no"
      style={{ colorScheme: theme, border: 0, background: 'transparent' }}
      className="block bg-transparent"
    />
  );
}
