import type { Endpoint } from '@/app/api-docs/endpoints';

// Docs code samples. The cURL example in endpoints.ts is the source of truth;
// JavaScript and Python versions are derived from it so the three never drift.

interface ParsedCurl {
  method: string;
  url: string;
  headers: [string, string][];
  form: [string, string][];
  json: string | null;
}

function parseCurl(curl: string, fallbackMethod: string): ParsedCurl {
  const flat = curl.replace(/\\\n\s*/g, ' ');
  const url = flat.match(/"(https?:\/\/[^"]+)"/)?.[1] || flat.match(/(https?:\/\/\S+)/)?.[1] || '';
  const method = flat.match(/-X\s+([A-Z]+)/)?.[1] || fallbackMethod;
  const headers = [...flat.matchAll(/-H\s+"([^:"]+):\s*([^"]*)"/g)].map((m) => [m[1], m[2]] as [string, string]);
  const form = [...flat.matchAll(/-F\s+(?:'([^']*)'|"([^"]*)"|(\S+))/g)].map((m) => {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    const i = raw.indexOf('=');
    return [raw.slice(0, i), raw.slice(i + 1)] as [string, string];
  });
  const json = flat.match(/-d\s+'([^']*)'/)?.[1] ?? null;
  return { method, url, headers, form, json };
}

export function codeExamples(endpoint: Endpoint): { curl: string; javascript: string; python: string } | null {
  if (!endpoint.curlExample) return null;
  const c = parseCurl(endpoint.curlExample, endpoint.method);

  // JavaScript (fetch)
  const jsLines: string[] = [];
  if (c.form.length) {
    jsLines.push('const form = new FormData();');
    for (const [k, v] of c.form) {
      jsLines.push(v.startsWith('@')
        ? `form.append(${JSON.stringify(k)}, fileInput.files[0]); // ${v.slice(1)}`
        : `form.append(${JSON.stringify(k)}, ${JSON.stringify(v)});`);
    }
    jsLines.push('');
  }
  const opts: string[] = [];
  if (c.method !== 'GET') opts.push(`  method: ${JSON.stringify(c.method)},`);
  const jsHeaders = [...c.headers];
  if (c.json) jsHeaders.push(['Content-Type', 'application/json']);
  if (jsHeaders.length) {
    opts.push('  headers: {');
    for (const [k, v] of jsHeaders) opts.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    opts.push('  },');
  }
  if (c.form.length) opts.push('  body: form,');
  if (c.json) opts.push(`  body: JSON.stringify(${c.json}),`);
  jsLines.push(`const res = await fetch(${JSON.stringify(c.url)}${opts.length ? `, {\n${opts.join('\n')}\n}` : ''});`);
  jsLines.push(endpoint.path.endsWith('.png') ? 'const image = await res.blob();' : 'const data = await res.json();');

  // Python (requests)
  const py: string[] = ['import requests', ''];
  const args: string[] = [JSON.stringify(c.url)];
  if (c.headers.length) args.push(`headers={${c.headers.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`);
  const files = c.form.filter(([, v]) => v.startsWith('@'));
  const fields = c.form.filter(([, v]) => !v.startsWith('@'));
  if (files.length) args.push(`files={${files.map(([k, v]) => `${JSON.stringify(k)}: open(${JSON.stringify(v.slice(1))}, "rb")`).join(', ')}}`);
  if (fields.length) args.push(`data={${fields.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`);
  if (c.json) args.push(`json=${c.json.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`);
  py.push(`res = requests.${c.method.toLowerCase()}(\n    ${args.join(',\n    ')},\n)`);
  py.push(endpoint.path.endsWith('.png') ? 'open("image.png", "wb").write(res.content)' : 'data = res.json()');

  return { curl: endpoint.curlExample, javascript: jsLines.join('\n'), python: py.join('\n') };
}
