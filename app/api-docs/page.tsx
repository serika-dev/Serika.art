import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, Globe, KeyRound, Gauge, AlertTriangle, ShieldCheck, Zap, BookOpen, Wand2 } from 'lucide-react';
import { endpoints, type Endpoint, type Param } from './endpoints';
import DocsNav, { type NavGroup } from '@/components/docs/DocsNav';
import { CodePanel } from '@/components/docs/CodePanel';
import { codeExamples } from '@/components/docs/examples';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Serika.art REST API: images, tags, users, random images, uploads and the autotagger.',
  alternates: { canonical: 'https://serika.art/api-docs' },
};

const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Images', ids: ['list-images', 'get-image', 'similar-images', 'delete-image'] },
  { title: 'Upload & tagging', ids: ['upload', 'autotag', 'image-autotag'] },
  { title: 'Tags', ids: ['list-tags'] },
  { title: 'Users', ids: ['list-users', 'get-user'] },
  { title: 'Random', ids: ['random', 'random-image'] },
  { title: 'Platform', ids: ['stats'] },
];

const GUIDE: { id: string; label: string }[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'rate-limits', label: 'Rate limits' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'errors', label: 'Errors' },
];

const methodStyle: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  POST: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  PUT: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  PATCH: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  DELETE: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
};

const byId = new Map(endpoints.map((e) => [e.id, e]));
const grouped = GROUPS.map((g) => ({ title: g.title, items: g.ids.map((id) => byId.get(id)).filter(Boolean) as Endpoint[] }));
// Anything added to endpoints.ts but not placed in a group still shows up
const ungrouped = endpoints.filter((e) => !GROUPS.some((g) => g.ids.includes(e.id)));
if (ungrouped.length) grouped.push({ title: 'More', items: ungrouped });

const navGroups: NavGroup[] = [
  { title: 'Guide', items: GUIDE },
  ...grouped.map((g) => ({ title: g.title, items: g.items.map((e) => ({ id: e.id, label: e.title, method: e.method })) })),
];

function Path({ path }: { path: string }) {
  return (
    <code className="break-all font-mono text-sm text-zinc-200">
      {path.split(/(:[a-z_]+)/i).map((part, i) =>
        part.startsWith(':') ? <span key={i} className="text-violet-300">{part}</span> : part
      )}
    </code>
  );
}

function Params({ title, params }: { title: string; params: Param[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="divide-y divide-border/40 rounded-xl border border-border/40">
        {params.map((p) => (
          <div key={p.name} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="font-mono text-sm font-semibold text-foreground">{p.name}</code>
              <span className="font-mono text-xs text-muted-foreground">{p.type}</span>
              {p.required && <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">required</span>}
              {p.default && <span className="text-xs text-muted-foreground">default <code className="font-mono">{p.default}</code></span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EndpointSection({ endpoint }: { endpoint: Endpoint }) {
  const examples = codeExamples(endpoint);
  const paramsTitle = endpoint.method === 'GET' || endpoint.method === 'DELETE' ? 'Parameters' : 'Path & query parameters';
  return (
    <section id={endpoint.id} className="scroll-mt-24 border-t border-border/40 py-12 first:border-t-0">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={cn('rounded-md px-2 py-0.5 font-mono text-xs font-bold ring-1 ring-inset', methodStyle[endpoint.method])}>{endpoint.method}</span>
              <Path path={endpoint.path} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              <a href={`#${endpoint.id}`} className="hover:underline">{endpoint.title}</a>
            </h2>
            <p className="mt-2 text-muted-foreground">{endpoint.description}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {endpoint.auth ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300 ring-1 ring-inset ring-amber-500/20">
                <Lock className="h-3 w-3" /> API key
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                <Globe className="h-3 w-3" /> Public
              </span>
            )}
            {endpoint.permission && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 font-mono text-muted-foreground ring-1 ring-inset ring-border/50">
                {endpoint.permission}
              </span>
            )}
          </div>

          {endpoint.longDescription && <p className="text-sm leading-relaxed text-foreground/80">{endpoint.longDescription}</p>}
          {endpoint.params && endpoint.params.length > 0 && <Params title={paramsTitle} params={endpoint.params} />}
          {endpoint.body && endpoint.body.length > 0 && <Params title="Request body" params={endpoint.body} />}
          {endpoint.headers && endpoint.headers.length > 0 && <Params title="Response headers" params={endpoint.headers} />}

          {endpoint.errorCodes && endpoint.errorCodes.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Errors</h4>
              <ul className="space-y-1.5">
                {endpoint.errorCodes.map((e) => (
                  <li key={`${e.code}-${e.meaning}`} className="flex gap-3 text-sm">
                    <code className="w-10 shrink-0 font-mono font-semibold text-rose-300">{e.code}</code>
                    <span className="text-muted-foreground">{e.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {endpoint.notes && endpoint.notes.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-card/40 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-muted-foreground" /> Notes</h4>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {endpoint.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          {examples && (
            <CodePanel
              title="Request"
              samples={[
                { label: 'cURL', code: examples.curl },
                { label: 'JavaScript', code: examples.javascript },
                { label: 'Python', code: examples.python },
              ]}
            />
          )}
          <CodePanel title="Response" samples={[{ label: 'JSON', code: endpoint.responseExample }]} />
        </div>
      </div>
    </section>
  );
}

function GuideSection({ id, icon: Icon, title, children }: { id: string; icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/40 py-10 first:border-t-0 first:pt-0">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-violet-300" /> {title}</h2>
      <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

const PERMISSIONS: [string, string][] = [
  ['images:read', 'List, search and read images; predict tags'],
  ['images:write', 'Edit posts, apply predicted tags to your posts'],
  ['images:delete', 'Delete images (admin only)'],
  ['tags:read', 'List and search tags'],
  ['tags:write', 'Create or modify tags'],
  ['users:read', 'Read user profiles'],
  ['random:read', 'Random image endpoints'],
  ['upload', 'Upload images'],
];

const ERRORS: [number, string, string][] = [
  [400, 'INVALID_ID', 'Malformed ID'],
  [400, 'MISSING_FILE', 'No file in an upload'],
  [400, 'INVALID_FILE_TYPE', 'Unsupported file format'],
  [400, 'FILE_TOO_LARGE', 'File exceeds 50MB'],
  [400, 'NOT_ENOUGH_TAGS', 'Fewer than 5 distinct tags on an upload'],
  [400, 'INVALID_RATING', 'Rating is not safe, questionable or explicit'],
  [401, 'UNAUTHORIZED', 'Missing or invalid API key'],
  [403, 'FORBIDDEN', 'Key lacks the permission, or you may not act on this post'],
  [404, 'NOT_FOUND', 'No such resource'],
  [429, 'RATE_LIMITED', 'Too many requests, slow down'],
  [503, 'AUTOTAGGER_UNAVAILABLE', 'The tagger is offline, retry later'],
  [500, 'INTERNAL_ERROR', 'Something broke on our side'],
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto flex max-w-[1500px] gap-10 px-4 sm:px-6 lg:px-8">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sk-scroll sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-2">
          <DocsNav groups={navGroups} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 py-10">
        <header className="mb-12">
          <p className="mb-2 text-sm font-semibold text-violet-300">API reference · v1</p>
          <h1 className="mb-4 text-4xl font-black tracking-tight">Build with Serika.art</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Search and fetch millions of tagged artworks, upload posts, and run the autotagger from your own apps and bots.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/api-keys" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:bg-violet-500">
              <KeyRound className="h-4 w-4" /> Get an API key
            </Link>
            <a href="#list-images" className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2.5 text-sm font-semibold hover:bg-card">
              <Zap className="h-4 w-4" /> Jump to endpoints
            </a>
            <a href="#autotag" className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2.5 text-sm font-semibold hover:bg-card">
              <Wand2 className="h-4 w-4" /> Autotagger
            </a>
          </div>
        </header>

        <details className="mb-10 rounded-xl border border-border/40 bg-card/40 p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold">Browse endpoints</summary>
          <div className="mt-4">
            <DocsNav groups={navGroups} />
          </div>
        </details>

        <GuideSection id="introduction" icon={Zap} title="Introduction">
          <p>
            All endpoints live under <code className="rounded bg-muted px-1.5 py-0.5 font-mono">https://serika.art/api/v1</code>, accept and return JSON,
            and wrap results as <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{'{ "success": true, "data": … }'}</code>.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Base URL', 'https://serika.art/api/v1'], ['Format', 'application/json'], ['Tags', 'Danbooru-style, e.g. long_hair']].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border/40 bg-card/40 p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-1 break-all font-mono text-sm">{v}</p>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection id="authentication" icon={KeyRound} title="Authentication">
          <p>
            Create a key on the <Link href="/api-keys" className="text-violet-300 hover:underline">API keys page</Link> and send it with every request.
            Keep it secret: it acts as your account.
          </p>
          <CodePanel samples={[{ label: 'Header', code: 'Authorization: Bearer sk_serika_YOUR_API_KEY\n# or\nX-API-Key: sk_serika_YOUR_API_KEY' }]} />
        </GuideSection>

        <GuideSection id="rate-limits" icon={Gauge} title="Rate limits">
          <p>Limits are per key, per minute. Going over returns <code className="rounded bg-muted px-1.5 py-0.5 font-mono">429 RATE_LIMITED</code>.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['User', '60'], ['Moderator', '120'], ['Admin', '1,000'], ['Owner', '10,000']].map(([rank, n]) => (
              <div key={rank} className="rounded-xl border border-border/40 bg-card/40 p-3">
                <p className="text-xs text-muted-foreground">{rank}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{n}<span className="text-xs font-normal text-muted-foreground"> /min</span></p>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection id="permissions" icon={ShieldCheck} title="Permissions">
          <p>Each key has scopes. New keys get the read scopes; ask for more when creating it.</p>
          <div className="divide-y divide-border/40 rounded-xl border border-border/40">
            {PERMISSIONS.map(([scope, what]) => (
              <div key={scope} className="flex gap-4 px-4 py-2.5">
                <code className="w-32 shrink-0 font-mono text-violet-300">{scope}</code>
                <span className="text-muted-foreground">{what}</span>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection id="errors" icon={AlertTriangle} title="Errors">
          <p>Errors use HTTP status codes plus a machine-readable <code className="rounded bg-muted px-1.5 py-0.5 font-mono">code</code>:</p>
          <CodePanel samples={[{ label: 'JSON', code: '{\n  "success": false,\n  "error": "Human-readable message",\n  "code": "ERROR_CODE"\n}' }]} />
          <div className="divide-y divide-border/40 rounded-xl border border-border/40">
            {ERRORS.map(([status, code, meaning]) => (
              <div key={code} className="flex gap-4 px-4 py-2.5">
                <code className={cn('w-10 shrink-0 font-mono font-semibold', status >= 500 ? 'text-rose-400' : 'text-amber-300')}>{status}</code>
                <code className="w-52 shrink-0 font-mono text-xs leading-5">{code}</code>
                <span className="text-muted-foreground">{meaning}</span>
              </div>
            ))}
          </div>
        </GuideSection>

        {grouped.map((group) => (
          <div key={group.title} className="mt-6">
            <h2 className="border-t border-border/40 pt-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h2>
            {group.items.map((endpoint) => <EndpointSection key={endpoint.id} endpoint={endpoint} />)}
          </div>
        ))}
      </main>
    </div>
  );
}
