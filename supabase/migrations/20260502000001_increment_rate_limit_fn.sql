-- Atomic rate limit increment RPC for fixed-window per-user rate limiting.
-- Called from Edge Functions via PostgREST (/rest/v1/rpc/increment_rate_limit).
-- Depends on table public.rate_limit_buckets.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id uuid,
  p_bucket_key text,
  p_window_start timestamptz
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_count int;
BEGIN
  INSERT INTO public.rate_limit_buckets (user_id, bucket_key, window_start, count)
  VALUES (p_user_id, p_bucket_key, p_window_start, 1)
  ON CONFLICT (user_id, bucket_key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_rate_limit(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_rate_limit(uuid, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.increment_rate_limit(uuid, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(uuid, text, timestamptz) TO service_role;
