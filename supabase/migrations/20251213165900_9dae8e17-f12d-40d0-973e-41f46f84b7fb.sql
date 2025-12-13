-- Add CHECK constraints to profiles table for server-side validation
-- This ensures data integrity even if client-side validation is bypassed

-- Display name: max 100 characters
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_display_name_length 
CHECK (display_name IS NULL OR char_length(display_name) <= 100);

-- Phone number: max 20 characters (international format)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_phone_number_length 
CHECK (phone_number IS NULL OR char_length(phone_number) <= 20);

-- Address: max 200 characters
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_address_length 
CHECK (address IS NULL OR char_length(address) <= 200);

-- City: max 100 characters
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_city_length 
CHECK (city IS NULL OR char_length(city) <= 100);

-- Postal code: max 20 characters
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_postal_code_length 
CHECK (postal_code IS NULL OR char_length(postal_code) <= 20);

-- Country: max 100 characters
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_country_length 
CHECK (country IS NULL OR char_length(country) <= 100);

-- Email: max 255 characters (standard email limit)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_length 
CHECK (char_length(email) <= 255);