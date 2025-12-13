-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: 1 week before launch (Feb 22, 2026 at 00:00 UTC)
SELECT cron.schedule(
  'launch-reminder-one-week',
  '0 0 22 2 *',
  $$
  SELECT net.http_post(
    url := 'https://rxzubvqznmvvarmfsioe.supabase.co/functions/v1/send-launch-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4enVidnF6bm12dmFybWZzaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MjQ3OTgsImV4cCI6MjA3MTAwMDc5OH0.Y87Xww3ltLX79mDCxs0medXzy_xA1nQywU4rKWMJvM8"}'::jsonb,
    body := '{"reminderType": "one_week"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule: 1 day before launch (Feb 28, 2026 at 00:00 UTC)
SELECT cron.schedule(
  'launch-reminder-one-day',
  '0 0 28 2 *',
  $$
  SELECT net.http_post(
    url := 'https://rxzubvqznmvvarmfsioe.supabase.co/functions/v1/send-launch-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4enVidnF6bm12dmFybWZzaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MjQ3OTgsImV4cCI6MjA3MTAwMDc5OH0.Y87Xww3ltLX79mDCxs0medXzy_xA1nQywU4rKWMJvM8"}'::jsonb,
    body := '{"reminderType": "one_day"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule: Launch day (March 1, 2026 at 00:00 UTC)
SELECT cron.schedule(
  'launch-reminder-launch-day',
  '0 0 1 3 *',
  $$
  SELECT net.http_post(
    url := 'https://rxzubvqznmvvarmfsioe.supabase.co/functions/v1/send-launch-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4enVidnF6bm12dmFybWZzaW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MjQ3OTgsImV4cCI6MjA3MTAwMDc5OH0.Y87Xww3ltLX79mDCxs0medXzy_xA1nQywU4rKWMJvM8"}'::jsonb,
    body := '{"reminderType": "launch_day"}'::jsonb
  ) AS request_id;
  $$
);