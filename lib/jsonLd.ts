/**
 * JSON-LD for <script> tags. Escapes "<" so user text (descriptions, tag
 * names) can never close the script element and inject markup, plus the two
 * line separators that are valid in JSON but not in older JS parsers.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(' ', 'g'), '\\u2028')
    .replace(new RegExp(' ', 'g'), '\\u2029');
}
