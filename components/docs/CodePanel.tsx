'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Highlight } from '@/components/docs/Highlight';
import { cn } from '@/lib/utils';

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn('rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100', className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const LANG_KEY = 'serika_docs_lang';
const LANG_EVENT = 'serika-docs-lang';

/** Code block with language tabs; the chosen language is shared by every panel on the page. */
export function CodePanel({ title, samples }: { title?: string; samples: { label: string; code: string }[] }) {
  const [lang, setLang] = useState(samples[0].label);

  // Remember the language and keep every panel on the page in sync
  useEffect(() => {
    const apply = (value: string | null) => value && samples.some((s) => s.label === value) && setLang(value);
    try { apply(localStorage.getItem(LANG_KEY)); } catch {}
    const onChange = (e: Event) => apply((e as CustomEvent<string>).detail);
    window.addEventListener(LANG_EVENT, onChange);
    return () => window.removeEventListener(LANG_EVENT, onChange);
  }, [samples]);

  const choose = (value: string) => {
    setLang(value);
    try { localStorage.setItem(LANG_KEY, value); } catch {}
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: value }));
  };
  const current = samples.find((s) => s.label === lang) ?? samples[0];

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d10]">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        {title && <span className="px-2 text-xs font-medium text-zinc-500">{title}</span>}
        {samples.length > 1 && samples.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => choose(s.label)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              s.label === current.label ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {s.label}
          </button>
        ))}
        <CopyButton text={current.code} className="ml-auto" />
      </div>
      <pre className="max-h-[480px] overflow-auto p-4 text-[13px] leading-relaxed text-zinc-300">
        <code><Highlight code={current.code} /></code>
      </pre>
    </div>
  );
}
