-- Fix #1: Add INSERT policy for profiles table
CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add trigger to auto-create profiles when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_status)
  VALUES (new.id, new.email, 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix #3: Create secure function for counting routes without service role
CREATE OR REPLACE FUNCTION public.count_routes_by_fingerprint(
  _fingerprint text,
  _ip_address text,
  _since timestamp with time zone
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM route_generations
  WHERE (device_fingerprint = _fingerprint OR ip_address = _ip_address)
    AND created_at >= _since;
$$;