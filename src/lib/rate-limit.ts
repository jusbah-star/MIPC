import 'server-only';

type Entry = { count: number; resetAt: number };
const globalRateLimits = globalThis as typeof globalThis & { mipcRateLimits?: Map<string, Entry> };
const store = globalRateLimits.mipcRateLimits ?? new Map<string, Entry>();
globalRateLimits.mipcRateLimits = store;

export function clientAddress(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) throw new Error('RATE_LIMITED');
  existing.count += 1;
}
