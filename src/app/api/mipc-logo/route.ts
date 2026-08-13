import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function fallbackLogo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
    <rect width="320" height="320" rx="160" fill="#ffffff"/>
    <circle cx="160" cy="160" r="142" fill="#f8fafc" stroke="#0b1d3a" stroke-width="8"/>
    <circle cx="160" cy="160" r="112" fill="#1d4932"/>
    <text x="160" y="150" text-anchor="middle" fill="#ffffff" font-family="Georgia,serif" font-size="58" font-weight="700">MIPC</text>
    <text x="160" y="194" text-anchor="middle" fill="#ddefe3" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="3">MUSANZE</text>
  </svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600'
    }
  });
}

function normalizeUrl(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/^\/\//, 'https://');
}

export async function GET() {
  try {
    const home = await fetch('https://mipc.ac.rw/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MIPC-Digital-Campus/1.0)' },
      next: { revalidate: 86400 }
    });
    if (!home.ok) return fallbackLogo();

    const html = await home.text();
    const candidates: string[] = [];

    const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(imgRegex)) {
      const tag = match[0].toLowerCase();
      const src = normalizeUrl(match[1]);
      if (tag.includes('logo') || tag.includes('site-logo') || src.toLowerCase().includes('logo')) {
        candidates.push(src);
      }
    }

    const ogLogo = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i);
    if (ogLogo?.[1]) candidates.push(normalizeUrl(ogLogo[1]));

    for (const candidate of candidates) {
      const url = candidate.startsWith('http') ? candidate : new URL(candidate, 'https://mipc.ac.rw/').toString();
      try {
        const image = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MIPC-Digital-Campus/1.0)', Accept: 'image/*' },
          next: { revalidate: 86400 }
        });
        if (!image.ok) continue;
        const type = image.headers.get('content-type') || '';
        const bytes = await image.arrayBuffer();
        if (!type.startsWith('image/') || bytes.byteLength < 4000) continue;
        return new NextResponse(bytes, {
          headers: {
            'Content-Type': type,
            'Content-Length': String(bytes.byteLength),
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
          }
        });
      } catch {}
    }

    return fallbackLogo();
  } catch {
    return fallbackLogo();
  }
}
