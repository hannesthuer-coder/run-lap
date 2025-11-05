-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  subscription_status TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create route generations tracking table
CREATE TABLE public.route_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  route_distance NUMERIC,
  route_unit TEXT,
  start_location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT
);

CREATE INDEX idx_route_gen_fingerprint ON public.route_generations(device_fingerprint);
CREATE INDEX idx_route_gen_user_id ON public.route_generations(user_id);
CREATE INDEX idx_route_gen_ip ON public.route_generations(ip_address);
CREATE INDEX idx_route_gen_created_at ON public.route_generations(created_at DESC);

ALTER TABLE public.route_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert route generation"
  ON public.route_generations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own generations"
  ON public.route_generations FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);