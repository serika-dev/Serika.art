// Serika tags use Danbooru-style names: lowercase, words joined by underscores
// ("simple_background", not "simple background"). Every place that stores or
// compares a tag name goes through this. Safe to import from client code.
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}
