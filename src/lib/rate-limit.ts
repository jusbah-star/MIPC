import 'server-only';
import { createHash } from 'crypto';
import { createAdminClient, isDemoModeEnabled, isSupabaseConfigured } from '@/lib/supabase/server';

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

function enforceLocalRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) throw new Error('RATE_LIMITED');
  existing.count += 1;
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  if (isSupabaseConfigured()) {
    try {
      const admin = createAdminClient();
      const keyHash = createHash('sha256').update(key).digest('hex');
      const { data, error } = await (admin as any).rpc('consume_rate_limit', {
        bucket_key_hash: keyHash,
        max_requests: limit,
        window_seconds: Math.max(1, Math.ceil(windowMs / 1000))
      });

      if (error) {
        console.error('Distributed rate-limit check failed', { code: error.code });
        throw new Error('RATE_LIMIT_UNAVAILABLE');
      }
      if (data !== true) throw new Error('RATE_LIMITED');
      return;
    } catch (error) {
      if (error instanceof Error && (error.message === 'RATE_LIMITED' || error.message === 'RATE_LIMIT_UNAVAILABLE')) {
        throw error;
      }
      console.error('Distributed rate-limit service unavailable');
      throw new Error('RATE_LIMIT_UNAVAILABLE');
    }
  }

  if (!isDemoModeEnabled()) throw new Error('BACKEND_NOT_CONFIGURED');
  enforceLocalRateLimit(key, limit, windowMs);
}
