-- Create rate_limits table for tracking API call rates
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  call_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(ip_address, endpoint, window_start)
);

-- Enable RLS but allow service role to manage
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can manage rate limits
-- (Edge functions use service role key for this)

-- Create index for faster lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(ip_address, endpoint, window_start);

-- Create cleanup function to remove old rate limit entries (older than 2 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE window_start < (now() - interval '2 hours');
$$;

-- Improve count_routes_by_fingerprint with input validation
CREATE OR REPLACE FUNCTION public.count_routes_by_fingerprint(
  _fingerprint text,
  _ip_address text,
  _since timestamp with time zone
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate fingerprint
  IF _fingerprint IS NULL OR length(_fingerprint) < 10 OR length(_fingerprint) > 100 THEN
    RAISE EXCEPTION 'Invalid fingerprint parameter';
  END IF;
  
  -- Validate time window (must be within last 90 days, not in future)
  IF _since IS NULL OR _since > now() OR _since < (now() - interval '90 days') THEN
    RAISE EXCEPTION 'Invalid time window parameter';
  END IF;
  
  RETURN (
    SELECT COUNT(*)::integer
    FROM route_generations
    WHERE (device_fingerprint = _fingerprint OR ip_address = _ip_address)
      AND created_at >= _since
  );
END;
$$;