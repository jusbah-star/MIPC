-- Shared request-rate accounting for serverless/scale-out deployments.
-- Only the server-side service role may access this table or function.

create table if not exists public.rate_limit_buckets (
  key_hash text primary key check (length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;

revoke all on table public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.rate_limit_buckets to service_role;

create index if not exists idx_rate_limit_buckets_updated_at
  on public.rate_limit_buckets(updated_at);

create or replace function public.consume_rate_limit(
  bucket_key_hash text,
  max_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  allowed boolean;
begin
  if bucket_key_hash is null or length(bucket_key_hash) <> 64 then
    raise exception 'bucket_key_hash must be a SHA-256 hex digest' using errcode = '22023';
  end if;
  if max_requests < 1 or window_seconds < 1 then
    raise exception 'rate-limit bounds must be positive' using errcode = '22023';
  end if;

  insert into public.rate_limit_buckets as bucket (
    key_hash,
    window_started_at,
    request_count,
    updated_at
  )
  values (bucket_key_hash, now(), 1, now())
  on conflict (key_hash) do update
  set
    request_count = case
      when bucket.window_started_at + make_interval(secs => window_seconds) <= now() then 1
      else bucket.request_count + 1
    end,
    window_started_at = case
      when bucket.window_started_at + make_interval(secs => window_seconds) <= now() then now()
      else bucket.window_started_at
    end,
    updated_at = now()
  returning request_count <= max_requests into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

comment on table public.rate_limit_buckets is
  'Server-only distributed rate-limit counters keyed by SHA-256 digests; periodically purge stale rows operationally.';
