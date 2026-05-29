'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ChevronLeft, ChevronRight, Copy, Check, Menu, Lock, Globe, BookOpen, Code, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import { endpoints, type Endpoint, type Param } from './endpoints';

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-3 right-3 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ParamTable({ title, params }: { title: string; params: Param[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h4>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400 hidden sm:table-cell">Default</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {params.map((p) => (
              <tr key={p.name} className="hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-mono text-sm text-primary">
                  {p.name}{p.required && <span className="text-red-400 ml-0.5">*</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-400/70">{p.type}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 hidden sm:table-cell">{p.default || '—'}</td>
                <td className="px-4 py-3 text-zinc-400 text-sm">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointDetail({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Badge variant="outline" className={`${methodColors[endpoint.method]} font-mono font-bold text-xs px-2.5 py-1 tracking-widest`}>
            {endpoint.method}
          </Badge>
          <code className="text-base sm:text-lg font-mono text-zinc-200 break-all">{endpoint.path}</code>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{endpoint.title}</h2>
        <p className="text-zinc-400 text-base leading-relaxed max-w-3xl">{endpoint.description}</p>
      </div>

      {/* Auth & Permission */}
      <div className="flex flex-wrap gap-3">
        {endpoint.auth ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Lock className="h-3.5 w-3.5" /> Authentication Required
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Globe className="h-3.5 w-3.5" /> Public — No Auth Required
          </div>
        )}
        {endpoint.permission && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-border text-zinc-300 text-xs font-mono">
            Permission: {endpoint.permission}
          </div>
        )}
      </div>

      <Separator />

      {/* Long Description */}
      {endpoint.longDescription && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-zinc-300 text-sm leading-relaxed">{endpoint.longDescription}</p>
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      {endpoint.params && endpoint.params.length > 0 && (
        <ParamTable title={endpoint.method === 'GET' ? 'Query Parameters' : 'Path Parameters'} params={endpoint.params} />
      )}

      {/* Request Body */}
      {endpoint.body && endpoint.body.length > 0 && <ParamTable title="Request Body" params={endpoint.body} />}

      {/* Response Headers */}
      {endpoint.headers && endpoint.headers.length > 0 && <ParamTable title="Response Headers" params={endpoint.headers} />}

      {/* Response Example */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-300 mb-3">Response Example</h4>
        <div className="relative rounded-lg border border-border bg-zinc-900 overflow-hidden">
          <CopyButton text={endpoint.responseExample} />
          <pre className="p-4 pr-12 text-sm font-mono text-zinc-300 overflow-x-auto">
            <code>{endpoint.responseExample}</code>
          </pre>
        </div>
      </div>

      {/* cURL Example */}
      {endpoint.curlExample && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Example Request</h4>
          <div className="relative rounded-lg border border-border bg-zinc-900 overflow-hidden">
            <CopyButton text={endpoint.curlExample} />
            <pre className="p-4 pr-12 text-sm font-mono text-zinc-300 overflow-x-auto">
              <code>{endpoint.curlExample}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Notes */}
      {endpoint.notes && endpoint.notes.length > 0 && (
        <Card className="border-zinc-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-zinc-300">
              <BookOpen className="h-4 w-4" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {endpoint.notes.map((n, i) => (
                <li key={i} className="text-sm text-zinc-400 flex gap-2">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Error Codes */}
      {endpoint.errorCodes && endpoint.errorCodes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Specific Error Codes</h4>
          <div className="space-y-2">
            {endpoint.errorCodes.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 font-mono text-xs">{e.code}</Badge>
                <span className="text-sm text-zinc-400">{e.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Serika API Reference</h2>
        <p className="text-zinc-400 text-base leading-relaxed max-w-3xl">
          Complete reference documentation for the Serika image platform REST API. All endpoints are versioned under <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs font-mono">/api/v1</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" /> Base URL</CardTitle></CardHeader>
          <CardContent><code className="text-sm font-mono text-primary">https://serika.art/api/v1</code></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4 text-blue-400" /> Response Format</CardTitle></CardHeader>
          <CardContent><code className="text-sm font-mono text-primary">application/json</code></CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Authentication</h3>
        <p className="text-zinc-400 text-sm mb-4">
          Generate an API key from your <a href="/settings" className="text-primary hover:underline">account settings</a>. Include it in every request via one of these methods:
        </p>
        <div className="space-y-3">
          <div className="relative rounded-lg border border-border bg-zinc-900 p-4">
            <code className="text-sm font-mono text-zinc-300">Authorization: Bearer sk_serika_YOUR_API_KEY</code>
            <Badge variant="outline" className="absolute top-3 right-3 text-[10px] text-emerald-400 border-emerald-500/30">Recommended</Badge>
          </div>
          <div className="rounded-lg border border-border bg-zinc-900 p-4">
            <code className="text-sm font-mono text-zinc-300">X-API-Key: sk_serika_YOUR_API_KEY</code>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Rate Limits</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Rank</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Requests / Minute</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-zinc-300">
              <tr><td className="px-4 py-3">User</td><td className="px-4 py-3 font-mono">60</td></tr>
              <tr><td className="px-4 py-3">Premium / Moderator</td><td className="px-4 py-3 font-mono">120</td></tr>
              <tr><td className="px-4 py-3">Admin</td><td className="px-4 py-3 font-mono">1,000</td></tr>
              <tr><td className="px-4 py-3">Owner</td><td className="px-4 py-3 font-mono">10,000</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-zinc-500 text-xs mt-3">Exceeding the limit returns <code className="px-1 py-0.5 bg-zinc-800 rounded text-xs font-mono">429 RATE_LIMITED</code>.</p>
      </div>

      <Separator />

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Permissions</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Scope</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Description</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-zinc-300">
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">images:read</td><td className="px-4 py-3">View images and metadata</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">images:write</td><td className="px-4 py-3">Modify image metadata</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">images:delete</td><td className="px-4 py-3">Delete images (admin only)</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">tags:read</td><td className="px-4 py-3">View and search tags</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">tags:write</td><td className="px-4 py-3">Create or modify tags</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">users:read</td><td className="px-4 py-3">View user profiles</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">random:read</td><td className="px-4 py-3">Access random image endpoints</td></tr>
              <tr><td className="px-4 py-3 font-mono text-xs text-primary">upload</td><td className="px-4 py-3">Upload images (moderator+ only)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-xl font-bold text-white mb-4">Error Response Format</h3>
        <div className="relative rounded-lg border border-border bg-zinc-900 overflow-hidden">
          <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto"><code>{`{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}`}</code></pre>
        </div>
        <div className="mt-4 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Code</th>
              <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400">Meaning</th>
            </tr></thead>
            <tbody className="divide-y divide-border text-zinc-300">
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">INVALID_ID</td><td className="px-4 py-2.5">Invalid resource ID format</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">MISSING_FILE</td><td className="px-4 py-2.5">No file provided for upload</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">INVALID_FILE_TYPE</td><td className="px-4 py-2.5">Unsupported file format</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">FILE_TOO_LARGE</td><td className="px-4 py-2.5">File exceeds 50MB limit</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">MISSING_TAGS</td><td className="px-4 py-2.5">At least one tag required</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-400">400</td><td className="px-4 py-2.5 font-mono text-xs">INVALID_RATING</td><td className="px-4 py-2.5">Invalid rating value</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-amber-400">401</td><td className="px-4 py-2.5 font-mono text-xs">UNAUTHORIZED</td><td className="px-4 py-2.5">Invalid or missing API key</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-amber-400">403</td><td className="px-4 py-2.5 font-mono text-xs">FORBIDDEN</td><td className="px-4 py-2.5">Insufficient permissions</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-amber-400">404</td><td className="px-4 py-2.5 font-mono text-xs">NOT_FOUND</td><td className="px-4 py-2.5">Resource not found</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-amber-400">429</td><td className="px-4 py-2.5 font-mono text-xs">RATE_LIMITED</td><td className="px-4 py-2.5">Too many requests</td></tr>
              <tr><td className="px-4 py-2.5 font-mono text-red-500">500</td><td className="px-4 py-2.5 font-mono text-xs">INTERNAL_ERROR</td><td className="px-4 py-2.5">Server error</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NavItem({ endpoint, active, onClick }: { endpoint: Endpoint; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm flex items-center gap-2.5 ${active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${methodColors[endpoint.method]}`}>{endpoint.method}</span>
      <span className="truncate">{endpoint.title}</span>
    </button>
  );
}

export default function ApiDocsPage() {
  const [activeId, setActiveId] = useState<string>('overview');

  const sidebar = (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground mb-1">API Reference</h1>
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
      <div>
        <button onClick={() => setActiveId('overview')} className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm flex items-center gap-2 ${activeId === 'overview' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
          <BookOpen className="h-3.5 w-3.5" /> Overview
        </button>
      </div>
      <Separator />
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-2">Endpoints</p>
        {endpoints.map((ep) => (
          <NavItem key={ep.id} endpoint={ep} active={activeId === ep.id} onClick={() => setActiveId(ep.id)} />
        ))}
      </div>
    </div>
  );

  const activeEndpoint = endpoints.find((e) => e.id === activeId);

  return (
    <div className="bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="max-w-7xl mx-auto lg:h-full">
        <div className="flex lg:h-full">
          {/* Desktop sidebar — fixed, scrolls independently */}
          <aside className="hidden lg:block w-72 flex-shrink-0 border-r border-border h-full overflow-y-auto p-6">
            {sidebar}
          </aside>

          {/* Mobile header */}
          <div className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="h-4 w-4" />
                  {activeId === 'overview' ? 'Overview' : activeEndpoint?.title || 'Menu'}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-6">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
          </div>

          {/* Main content — scrolls independently on desktop */}
          <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-12 pt-24 lg:pt-12 lg:overflow-y-auto lg:h-full">
            {activeId === 'overview' ? <OverviewPage /> : activeEndpoint ? <EndpointDetail endpoint={activeEndpoint} /> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
