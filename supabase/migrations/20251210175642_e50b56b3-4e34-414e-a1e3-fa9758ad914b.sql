-- Fix RLS policy for saved_routes to handle null subscription_expires_at
DROP POLICY IF EXISTS "Premium users can insert saved routes" ON saved_routes;
CREATE POLICY "Premium users can insert saved routes" ON saved_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_status = 'premium'
      AND (profiles.subscription_expires_at IS NULL OR profiles.subscription_expires_at > now())
    )
  );

-- Also fix shared_routes policy for consistency
DROP POLICY IF EXISTS "Premium users can create shared routes" ON shared_routes;
CREATE POLICY "Premium users can create shared routes" ON shared_routes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.subscription_status = 'premium'
      AND (profiles.subscription_expires_at IS NULL OR profiles.subscription_expires_at > now())
    )
  );