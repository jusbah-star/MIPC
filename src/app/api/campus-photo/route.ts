import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sources: Record<string, string> = {
  graduation: 'https://mipc.ac.rw/wp-content/uploads/2025/06/3D0A0894-scaled.jpg',
  construction: 'https://karibumedia.rw/wp-content/uploads/2025/09/WhatsApp-Image-2025-09-14-at-11.16.37-1.jpeg'
};

async function fallbackImage() {
  const file = await readFile(path.join(process.cwd(), 'public', 'campus-front.webp'));
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
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
        'User-Agent': 'Mozilla/5.0 MIPC-Digital-Campus/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      cache: 'force-cache'
    });

    if (!response.ok) return fallbackImage();
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 10000) return fallbackImage();

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
      }
    });
  } catch {
    return fallbackImage();
  }
}
