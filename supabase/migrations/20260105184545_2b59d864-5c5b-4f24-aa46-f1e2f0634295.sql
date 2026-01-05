-- Allow NULL user_id in route_generations for anonymous users
ALTER TABLE route_generations ALTER COLUMN user_id DROP NOT NULL;