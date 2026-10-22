// Posts-grid view preferences (grid size, posts per page, sidebar, hide AI,
// infinite scroll) and the tag blacklist, kept in cookies so the server renders
// the grid the way the visitor will see it. They used to live only in
// localStorage, read after hydration: the page painted with defaults and then
// reflowed (and often refetched) – most of the posts page's layout shift.
// localStorage keeps a copy for older code (settings export) and as the
// migration source for visitors who don't have the cookies yet.
// Safe to import from server and client code.
import { normalizeTagName } from '@/lib/tagName';

export type GridSize = 'small' | 'medium' | 'large';

export interface ViewPrefs {
  gridSize: GridSize;
  postsPerPage: number;
  sidebarCollapsed: boolean;
  hideAI: boolean;
  infiniteScroll: boolean;
}

export interface BlacklistPrefs {
  enabled: boolean;
  tags: string[];
}

export const VIEW_COOKIE = 'serika_view';
export const BLACKLIST_COOKIE = 'serika_bl';

export const DEFAULT_VIEW_PREFS: ViewPrefs = {
  gridSize: 'medium',
  postsPerPage: 24,
  sidebarCollapsed: false,
  hideAI: false,
  infiniteScroll: false,
};

const POSTS_PER_PAGE_OPTIONS = [12, 24, 48, 96];
// Cookies max out around 4 KB; a blacklist longer than this stays client-only
const MAX_BLACKLIST_COOKIE = 3000;

function decode(value: string | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** "g=small;p=48;s=1;a=1;i=1" */
export function parseViewPrefs(raw: string | undefined): ViewPrefs {
  const prefs = { ...DEFAULT_VIEW_PREFS };
  for (const part of decode(raw).split(';')) {
    const [k, v] = part.split('=');
    if (k === 'g' && (v === 'small' || v === 'medium' || v === 'large')) prefs.gridSize = v;
    else if (k === 'p' && POSTS_PER_PAGE_OPTIONS.includes(Number(v))) prefs.postsPerPage = Number(v);
    else if (k === 's') prefs.sidebarCollapsed = v === '1';
    else if (k === 'a') prefs.hideAI = v === '1';
    else if (k === 'i') prefs.infiniteScroll = v === '1';
  }
  return prefs;
}

export function serializeViewPrefs(p: ViewPrefs): string {
  return `g=${p.gridSize};p=${p.postsPerPage};s=${p.sidebarCollapsed ? 1 : 0};a=${p.hideAI ? 1 : 0};i=${p.infiniteScroll ? 1 : 0}`;
}

/** "1|tag_a,tag_b" (enabled flag, then tags) */
export function parseBlacklist(raw: string | undefined): BlacklistPrefs | null {
  const value = decode(raw);
  if (!value) return null;
  const [flag, list = ''] = value.split('|');
  return { enabled: flag !== '0', tags: list.split(',').map((t) => t.trim()).filter(Boolean) };
}

export function serializeBlacklist(b: BlacklistPrefs): string | null {
  const value = `${b.enabled ? 1 : 0}|${b.tags.map(normalizeTagName).join(',')}`;
  return value.length <= MAX_BLACKLIST_COOKIE ? value : null;
}

/** Same test as lib/blacklist shouldHideImage, without touching localStorage. */
export function hiddenByBlacklist(tags: (string | { name: string })[], blacklist: BlacklistPrefs | null): boolean {
  if (!blacklist || !blacklist.enabled || blacklist.tags.length === 0) return false;
  const names = new Set(tags.map((t) => normalizeTagName(typeof t === 'string' ? t : t.name || '')));
  return blacklist.tags.some((t) => names.has(normalizeTagName(t)));
}

// ── Client side ────────────────────────────────────────────────────────────

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/** Current prefs in the browser: the cookie, else the old localStorage keys. */
export function readViewPrefs(): ViewPrefs {
  if (typeof document === 'undefined') return { ...DEFAULT_VIEW_PREFS };
  const cookie = readCookie(VIEW_COOKIE);
  if (cookie) return parseViewPrefs(cookie);
  const prefs = { ...DEFAULT_VIEW_PREFS };
  try {
    const g = localStorage.getItem('serika_grid_size');
    if (g === 'small' || g === 'medium' || g === 'large') prefs.gridSize = g;
    const p = Number(localStorage.getItem('serika_posts_per_page'));
    if (POSTS_PER_PAGE_OPTIONS.includes(p)) prefs.postsPerPage = p;
    prefs.sidebarCollapsed = localStorage.getItem('serika_posts_sidebar') === 'collapsed';
    prefs.hideAI = localStorage.getItem('serika_hide_ai_default') === 'true';
    prefs.infiniteScroll = localStorage.getItem('serika_infinite_scroll') === 'true';
  } catch {}
  return prefs;
}

/** Save some prefs: cookie for the server, localStorage for older readers. */
export function writeViewPrefs(update: Partial<ViewPrefs>): ViewPrefs {
  const next = { ...readViewPrefs(), ...update };
  setCookie(VIEW_COOKIE, serializeViewPrefs(next));
  try {
    localStorage.setItem('serika_grid_size', next.gridSize);
    localStorage.setItem('serika_posts_per_page', String(next.postsPerPage));
    localStorage.setItem('serika_posts_sidebar', next.sidebarCollapsed ? 'collapsed' : 'open');
    localStorage.setItem('serika_hide_ai_default', String(next.hideAI));
    localStorage.setItem('serika_infinite_scroll', String(next.infiniteScroll));
  } catch {}
  return next;
}

export function writeBlacklistCookie(b: BlacklistPrefs) {
  if (typeof document === 'undefined') return;
  const value = serializeBlacklist(b);
  if (value === null) document.cookie = `${BLACKLIST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  else setCookie(BLACKLIST_COOKIE, value);
}
