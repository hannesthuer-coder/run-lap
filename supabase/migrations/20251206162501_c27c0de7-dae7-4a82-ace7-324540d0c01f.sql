-- Add avatar_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add display_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create shared_routes table for route sharing
CREATE TABLE public.shared_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_code text UNIQUE NOT NULL,
  route_geometry jsonb NOT NULL,
  distance numeric NOT NULL,
  unit text NOT NULL,
  start_location text NOT NULL,
  route_name text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days')
);

-- Enable RLS on shared_routes
ALTER TABLE public.shared_routes ENABLE ROW LEVEL SECURITY;

-- Anyone can view shared routes by share_code (public access)
CREATE POLICY "Anyone can view shared routes"
ON public.shared_routes FOR SELECT
USING (true);

-- Only premium users can create shared routes
CREATE POLICY "Premium users can create shared routes"
ON public.shared_routes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.subscription_status = 'premium' 
    AND profiles.subscription_expires_at > now()
  )
);

-- Users can delete their own shared routes
CREATE POLICY "Users can delete own shared routes"
ON public.shared_routes FOR DELETE
USING (auth.uid() = user_id);