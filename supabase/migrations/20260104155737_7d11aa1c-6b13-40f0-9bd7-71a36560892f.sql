-- Drop existing SELECT policies on profiles and recreate with explicit role targeting
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Drop existing SELECT policy on subscriptions and recreate with explicit role targeting  
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;

CREATE POLICY "Users can read own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);