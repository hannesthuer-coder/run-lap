-- Fix subscriptions table: Replace restrictive policy with a permissive one
-- that properly restricts access to only the authenticated user's own subscription

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;

-- Create a proper PERMISSIVE policy that only allows authenticated users to read their own subscription
-- This ensures unauthenticated/anonymous users cannot read any subscription data
CREATE POLICY "Users can read own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);