-- Create saved_routes table for premium users
CREATE TABLE public.saved_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_name text NOT NULL,
  distance numeric NOT NULL,
  unit text NOT NULL CHECK (unit IN ('km', 'miles')),
  start_location text NOT NULL,
  route_geometry jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_route_name UNIQUE(user_id, route_name)
);

-- Enable RLS
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved routes
CREATE POLICY "Users can view own saved routes"
  ON public.saved_routes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Premium users can insert saved routes
CREATE POLICY "Premium users can insert saved routes"
  ON public.saved_routes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND subscription_status = 'premium'
        AND subscription_expires_at > now()
    )
  );

-- Users can delete their own saved routes
CREATE POLICY "Users can delete own saved routes"
  ON public.saved_routes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_saved_routes_user_id ON public.saved_routes(user_id);
CREATE INDEX idx_saved_routes_created_at ON public.saved_routes(created_at DESC);