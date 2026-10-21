import { Fragment } from 'react';

// Tiny syntax highlighter for the docs' JSON, shell, JS and Python snippets –
// enough to make them readable without shipping a highlighting library.

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|('(?:[^'\\]|\\.)*')|\b(true|false|null|None|True|False|const|await|import|new|open)\b|(-?\b\d+(?:\.\d+)?\b)|(#[^\n]*|\/\/[^\n]*)|(\s-[A-Za-z]\b|\bcurl\b|\bfetch\b|\brequests\b)/g;

export function Highlight({ code }: { code: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push(code.slice(last, start));
    const [text, str, colon, sq, kw, num, comment, cmd] = m;
    const cls = str
      ? colon ? 'text-sky-300' : 'text-emerald-300'
      : sq ? 'text-emerald-300'
      : kw ? 'text-violet-300'
      : num ? 'text-amber-300'
      : comment ? 'text-zinc-500'
      : cmd ? 'text-pink-300'
      : '';
    out.push(
      <Fragment key={i++}>
        <span className={cls}>{str ?? text}</span>
        {colon && <span className="text-zinc-500">{colon}</span>}
      </Fragment>
    );
    last = start + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return <>{out}</>;
}
