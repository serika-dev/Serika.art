// Client-side blacklist management

const BLACKLIST_KEY = 'serika_tag_blacklist';
const BLACKLIST_ENABLED_KEY = 'serika_blacklist_enabled';

export function getBlacklistedTags(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(BLACKLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function setBlacklistedTags(tags: string[]): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(BLACKLIST_KEY, JSON.stringify(tags));
}

export function addBlacklistedTag(tag: string): void {
  const tags = getBlacklistedTags();
  const normalizedTag = tag.toLowerCase().trim();
  
  if (!tags.includes(normalizedTag)) {
    tags.push(normalizedTag);
    setBlacklistedTags(tags);
  }
}

export function removeBlacklistedTag(tag: string): void {
  const tags = getBlacklistedTags();
  const normalizedTag = tag.toLowerCase().trim();
  const filtered = tags.filter(t => t !== normalizedTag);
  setBlacklistedTags(filtered);
}

export function isTagBlacklisted(tag: string): boolean {
  const tags = getBlacklistedTags();
  return tags.includes(tag.toLowerCase().trim());
}

export function isBlacklistEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  
  try {
    const stored = localStorage.getItem(BLACKLIST_ENABLED_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setBlacklistEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(BLACKLIST_ENABLED_KEY, String(enabled));
}

export function shouldHideImage(imageTags: (string | { name: string })[]): boolean {
  if (!isBlacklistEnabled()) return false;
  
  const blacklist = getBlacklistedTags();
  if (blacklist.length === 0) return false;
  
  const normalizedImageTags = imageTags.map(t => {
    if (typeof t === 'string') return t.toLowerCase();
    return t.name?.toLowerCase() || '';
  });
  
  return blacklist.some(blacklistedTag => 
    normalizedImageTags.includes(blacklistedTag)
  );
}
