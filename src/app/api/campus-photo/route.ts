import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sources: Record<string, string> = {
  hero: 'https://www.kigalitoday.com/IMG/jpg/iyi_ni_yo_nyubako_yuzuye_itwaye_miliyoni_500_izatahwa_ubwo_hazaba_hanatangwa_impamyabumenyi.jpg',
  campus: 'https://pbs.twimg.com/media/EdKJhQSWsAMRBIj.jpg',
  graduation: 'https://mipc.ac.rw/wp-content/uploads/2025/06/3D0A0894-scaled.jpg',
  construction: 'https://karibumedia.rw/wp-content/uploads/2025/09/WhatsApp-Image-2025-09-14-at-11.16.37-1.jpeg',
  community: 'https://mamaurwagasabo.rw/IMG/jpg/img-20241206-wa0033.jpg'
};

function fallbackImage(label: string) {
  const safeLabel = label.replace(/[^a-z0-9 -]/gi, '').slice(0, 32) || 'MIPC';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#061022"/><stop offset="1" stop-color="#1d4932"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><text x="80" y="860" fill="white" font-family="Arial,sans-serif" font-size="72" font-weight="700">MIPC</text><text x="80" y="930" fill="#8fc6a2" font-family="Arial,sans-serif" font-size="34">${safeLabel}</text></svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600'
    }
  });
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name') ?? '';
  const source = sources[name];
  if (!source) return new NextResponse('Not found', { status: 404 });

  try {
    const response = await fetch(source, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MIPC-Digital-Campus/1.0)',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      next: { revalidate: 86400 }
    });

    if (!response.ok) return fallbackImage(name);
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    if (bytes.byteLength < 10000 || !contentType.startsWith('image/')) {
      return fallbackImage(name);
    }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
      }
    });
  } catch {
    return fallbackImage(name);
  }
}
