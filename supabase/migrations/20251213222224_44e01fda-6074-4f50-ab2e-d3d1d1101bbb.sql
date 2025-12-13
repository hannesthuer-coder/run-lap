INSERT INTO public.user_roles (user_id, role) 
VALUES ('d72a6a66-6ecb-445c-8c45-1bce477b99dc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;