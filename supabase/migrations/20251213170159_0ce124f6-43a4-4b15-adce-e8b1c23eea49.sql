-- Fix profiles table: Replace restrictive policy with a permissive one
-- that properly restricts access to only the authenticated user's own profile

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- Create a proper PERMISSIVE policy that only allows users to read their own profile
-- This ensures unauthenticated users cannot read any profiles
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);