/**
 * Configure Cloudflare for serika.art speed.
 *
 *   CLOUDFLARE_API_TOKEN=... npx tsx scripts/cloudflare-optimize.ts           # dry run: print the plan
 *   CLOUDFLARE_API_TOKEN=... npx tsx scripts/cloudflare-optimize.ts --apply   # make the changes
 *
 * Token permissions: Zone → Zone Settings: Edit, Cache Rules: Edit, Zone: Read
 * (plus "Cache Settings: Edit" for Smart Tiered Cache). CLOUDFLARE_ZONE
 * defaults to serika.art.
 *
 * What it does
 *  - Cache Rules: make an allowlist of serika.art pages/APIs (see
 *    CACHEABLE_PREFIXES) *eligible* for the edge cache, with the edge TTL
 *    taken from the origin's Cache-Control and BYPASSED when the origin sends
 *    none. The app only marks shareable responses public (lib/cacheHeaders.ts,
 *    ISR pages), so personal responses are never stored. /_next/static and
 *    other static files are cached by Cloudflare already.
 *  - cdn.serika.art: cache everything for a year at the edge (immutable files).
 *  - Smart Tiered Cache, HTTP/3, 0-RTT, Early Hints, Brotli, Speed Brain.
 *  - Rocket Loader off (it rewrites scripts and breaks React hydration).
 *
 * Only rules whose description starts with "serika-perf:" are replaced;
 * other cache rules on the zone are left as they are.
 */

const API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_NAME = process.env.CLOUDFLARE_ZONE || 'serika.art';
const APPLY = process.argv.includes('--apply');
const RULE_PREFIX = 'serika-perf:';

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (see the comment at the top of this file).');
  process.exit(1);
}

async function cf<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err: any = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json.errors || json)}`);
    err.status = res.status;
    throw err;
  }
  return json.result as T;
}

// Only these paths are made eligible for the edge cache (an allowlist, so a
// new route is never cached by accident). Within them, the origin's
// Cache-Control still decides: responses without one, or marked
// private/no-store (/api/images/:id, comments, user interactions…), bypass.
const CACHEABLE_PREFIXES = [
  '/image/',        // ISR post pages (s-maxage=300)
  '/api/images',    // listings (public, s-maxage=30)
  '/api/tags',      // tag lookups + autocomplete
  '/api/artists',
  '/api/autotag',   // GET: "is the tagger enabled"
  '/api/v1/random/',// random image.png
  '/_next/image',   // resized images (1 year)
  '/og-image',
  '/sitemap',
];

const cacheableExpr = [
  'http.request.uri.path eq "/"',
  ...CACHEABLE_PREFIXES.map((p) => `starts_with(http.request.uri.path, "${p}")`),
].join(' or ');

const CACHE_RULES = [
  {
    description: `${RULE_PREFIX} site – origin Cache-Control decides, bypass when absent`,
    expression: `(http.host eq "${ZONE_NAME}" and (${cacheableExpr}))`,
    action: 'set_cache_settings',
    action_parameters: {
      cache: true,
      edge_ttl: { mode: 'bypass_by_default' },
      browser_ttl: { mode: 'respect_origin' },
      serve_stale: { disable_stale_while_updating: false },
      respect_strong_etags: true,
      cache_key: { ignore_query_strings_order: true },
    },
    enabled: true,
  },
  {
    description: `${RULE_PREFIX} cdn – immutable files, cache for a year`,
    expression: `(http.host eq "cdn.${ZONE_NAME}")`,
    action: 'set_cache_settings',
    action_parameters: {
      cache: true,
      edge_ttl: { mode: 'override_origin', default: 31536000 },
      browser_ttl: { mode: 'respect_origin' },
      cache_key: { ignore_query_strings_order: true },
    },
    enabled: true,
  },
];

const ZONE_SETTINGS: Record<string, string> = {
  http3: 'on',
  '0rtt': 'on',
  early_hints: 'on',
  brotli: 'on',
  speed_brain: 'on',
  rocket_loader: 'off',
};

async function main() {
  const zones = await cf<any[]>('GET', `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (!zones.length) throw new Error(`Zone ${ZONE_NAME} not found for this token`);
  const zoneId = zones[0].id;
  console.log(`Zone ${ZONE_NAME} (${zoneId}) – ${APPLY ? 'APPLYING' : 'dry run, pass --apply to make changes'}\n`);

  // ── Zone settings ──
  for (const [id, value] of Object.entries(ZONE_SETTINGS)) {
    let current = '?';
    try {
      current = (await cf<any>('GET', `/zones/${zoneId}/settings/${id}`)).value;
    } catch (err: any) {
      console.log(`  setting ${id}: not readable (${err.status}) – skipped`);
      continue;
    }
    if (current === value) {
      console.log(`  setting ${id}: already ${value}`);
      continue;
    }
    console.log(`  setting ${id}: ${current} → ${value}`);
    if (APPLY) {
      try {
        await cf('PATCH', `/zones/${zoneId}/settings/${id}`, { value });
      } catch (err: any) {
        console.log(`    ! failed: ${err.message}`);
      }
    }
  }

  // ── Smart Tiered Cache (free on all plans) ──
  try {
    const tiered = await cf<any>('GET', `/zones/${zoneId}/cache/tiered_cache_smart_topology_enable`);
    if (tiered.value === 'on') {
      console.log('  smart tiered cache: already on');
    } else {
      console.log(`  smart tiered cache: ${tiered.value} → on`);
      if (APPLY) await cf('PATCH', `/zones/${zoneId}/cache/tiered_cache_smart_topology_enable`, { value: 'on' });
    }
  } catch (err: any) {
    console.log(`  smart tiered cache: not available (${err.message})`);
  }

  // ── Cache rules (merge: only our own rules are replaced) ──
  const phasePath = `/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`;
  let existing: any[] = [];
  try {
    existing = (await cf<any>('GET', phasePath)).rules || [];
  } catch (err: any) {
    if (err.status !== 404) throw err; // 404 = no cache rules yet
  }
  const kept = existing
    .filter((r) => !String(r.description || '').startsWith(RULE_PREFIX))
    .map(({ id, version, last_updated, ref, ...rule }) => ({ ...rule, ...(ref && { ref }) }));
  const replaced = existing.length - kept.length;

  console.log(`\n  cache rules: keeping ${kept.length} existing, replacing ${replaced} serika-perf rule(s) with ${CACHE_RULES.length}:`);
  for (const rule of CACHE_RULES) console.log(`    - ${rule.description}`);

  if (APPLY) {
    // Our rules go first; a later matching rule overrides earlier settings, so
    // anything already on the zone keeps the final say.
    await cf('PUT', phasePath, { rules: [...CACHE_RULES, ...kept] });
  }

  console.log(APPLY ? '\nDone. Request /api/images?page=1 twice and check for cf-cache-status: HIT.' : '\nNothing changed (dry run).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
