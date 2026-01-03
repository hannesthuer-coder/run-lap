-- Create table for tracking processed Stripe webhook events
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_processed_webhook_events_stripe_event_id 
  ON public.processed_webhook_events (stripe_event_id);

-- Create index for cleanup queries
CREATE INDEX idx_processed_webhook_events_processed_at 
  ON public.processed_webhook_events (processed_at);

-- Enable RLS
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can manage webhook events (from edge functions)
CREATE POLICY "Service role can manage webhook events"
  ON public.processed_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create cleanup function for old webhook events (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM processed_webhook_events 
  WHERE processed_at < (now() - interval '30 days');
$$;