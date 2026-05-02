-- Rate-limit bucket counters for the AI proxy Edge Functions.
--
-- Counters are upserted from Edge Functions using:
--   INSERT INTO rate_limit_buckets (user_id, bucket_key, window_start, count)
--   VALUES ($1, $2, $3, 1)
--   ON CONFLICT (user_id, bucket_key, window_start)
--   DO UPDATE SET count = rate_limit_buckets.count + 1
--   RETURNING count;
--
-- Bucket keys distinguish traffic classes (e.g., 'ai-default', 'ai-byok').
-- A periodic GC job deletes rows with window_start older than the longest
-- active window (uses idx_rate_limit_buckets_gc).

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  user_id      uuid        NOT NULL,
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        int         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_gc
  ON public.rate_limit_buckets (window_start);

-- RLS: service_role only. No policies = no access for authenticated/anon;
-- service_role bypasses RLS and is the sole writer/reader.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.rate_limit_buckets IS
  'Per-user rate-limit counters keyed by (user_id, bucket_key, window_start). Bucket keys distinguish default vs BYOK. Counters are upserted with ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count.';
