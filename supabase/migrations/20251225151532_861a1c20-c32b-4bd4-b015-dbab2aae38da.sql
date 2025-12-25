-- Add service role policy for rate_limits table
-- This allows the edge functions (using service role) to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);