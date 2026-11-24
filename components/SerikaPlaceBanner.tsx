import { Paintbrush, X } from 'lucide-react';

export const SERIKA_PLACE_URL = 'https://place.serika.dev';

/** Bump this to show the banner again to everyone who dismissed it. */
const STORAGE_KEY = 'serika-place-banner-dismissed';
const HIDE_ATTR = 'data-hide-place-banner';

/**
 * Runs before paint, so a dismissed banner never flashes in on load,
 * and handles the dismiss click without shipping a client component.
 */
const SCRIPT = `(function(){var k=${JSON.stringify(STORAGE_KEY)},a=${JSON.stringify(HIDE_ATTR)},d=document.documentElement;
try{if(localStorage.getItem(k))d.setAttribute(a,'')}catch(e){}
document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest||!t.closest('[data-dismiss-place-banner]'))return;
d.setAttribute(a,'');try{localStorage.setItem(k,'1')}catch(e){}});})();`;

/** Thin strip above the navbar inviting people to draw on SerikaPlace. Dismissible per browser. */
export default function SerikaPlaceBanner() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <style>{`html[${HIDE_ATTR}] #serika-place-banner{display:none}`}</style>
      <div
        id="serika-place-banner"
        className="relative border-b border-violet-400/20 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-violet-500/15"
      >
        <a
          href={SERIKA_PLACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-10 items-center justify-center gap-2 px-12 py-2 text-center text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/50"
        >
          <Paintbrush className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
          <span>
            <span className="font-bold">SerikaPlace</span> is live! Come draw something on{' '}
            <span className="font-bold text-violet-300 underline-offset-4 group-hover:underline">
              place.serika.dev
            </span>
          </span>
        </a>
        <button
          type="button"
          data-dismiss-place-banner
          aria-label="Dismiss SerikaPlace banner"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
