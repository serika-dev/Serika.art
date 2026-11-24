import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 30;

/**
 * Better Stack's badge is white text on a transparent page. Chrome paints an
 * opaque white canvas behind a cross-origin frame when this site is
 * color-scheme: dark, so the label disappears. Serving the same HTML from
 * our origin lets the frame stay transparent and the text stay readable.
 */
export async function GET(request: NextRequest) {
  const theme = request.nextUrl.searchParams.get('theme') === 'light' ? 'light' : 'dark';

  let upstream: Response;
  try {
    upstream = await fetch(`https://status.serika.dev/badge?theme=${theme}`, {
      next: { revalidate: 30 },
    });
  } catch {
    return new NextResponse('Status badge unavailable', { status: 502 });
  }
  if (!upstream.ok) {
    return new NextResponse('Status badge unavailable', { status: upstream.status });
  }

  let html = (await upstream.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const fix = `<meta name="color-scheme" content="${theme}"><style>html,body{background:transparent!important;margin:0;color-scheme:${theme}}</style>`;
  html = html.includes('</head>') ? html.replace('</head>', `${fix}</head>`) : `${fix}${html}`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
