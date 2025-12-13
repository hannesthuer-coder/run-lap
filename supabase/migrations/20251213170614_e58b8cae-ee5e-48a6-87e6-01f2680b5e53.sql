-- Fix waitlist table: Remove the overly permissive SELECT policy
-- Service role key bypasses RLS anyway, so this policy is unnecessary
-- and exposes PII (emails, IP addresses) to anonymous users

DROP POLICY IF EXISTS "Service role can read waitlist" ON public.waitlist;