-- Create waitlist table for pre-launch signups
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT,
  campaign TEXT,
  medium TEXT,
  ip_address TEXT,
  referrer TEXT
);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (signup)
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read (for admin purposes)
CREATE POLICY "Service role can read waitlist"
  ON public.waitlist FOR SELECT
  TO service_role
  USING (true);