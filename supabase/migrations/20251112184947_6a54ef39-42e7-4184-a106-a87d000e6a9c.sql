-- Fix public data exposure in route_generations table
-- Remove the NULL check that allows unauthenticated access to PII

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can read own generations" ON public.route_generations;

-- Create a new policy that only allows authenticated users to read their own data
CREATE POLICY "Users can read own generations" 
ON public.route_generations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update the INSERT policy to require user_id to be set to the authenticated user
DROP POLICY IF EXISTS "Anyone can insert route generation" ON public.route_generations;

CREATE POLICY "Authenticated users can insert own generations" 
ON public.route_generations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);