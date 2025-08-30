-- Fix OTP expiry to be within recommended threshold (reduce from default)
UPDATE auth.config SET email_otp_expire = 3600; -- Set to 1 hour (3600 seconds)
UPDATE auth.config SET phone_otp_expire = 600;  -- Set to 10 minutes (600 seconds)