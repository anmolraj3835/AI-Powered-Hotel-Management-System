-- ============================================================================
-- FIX AUTH TRIGGER & CREATE OFFICIAL HOTEL USER ACCOUNTS (FIXED FOR SUPABASE)
-- ============================================================================
-- Run this in Supabase: https://supabase.com/dashboard/project/vjqlpjknviclokjsqlxa/sql/new
-- ============================================================================

-- 1. Ensure pgcrypto extension is active for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop any legacy trigger that was throwing enum errors on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Ensure profiles table accepts text roles (ADMIN, STAFF, CUSTOMER)
ALTER TABLE public.profiles ALTER COLUMN role TYPE text;

-- 4. Create a clean, fail-safe profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    CASE 
      WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) IN ('admin', 'hostel_admin') OR LOWER(NEW.email) LIKE '%admin%' THEN 'ADMIN'
      WHEN LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')) IN ('staff', 'maintenance_staff') OR LOWER(NEW.email) LIKE '%staff%' THEN 'STAFF'
      ELSE 'CUSTOMER'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    role       = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Catch-all prevents any error in profile creation from aborting auth signups
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Delete existing accounts with these emails to avoid any conflict
DELETE FROM auth.users WHERE email IN ('admin@hotel.com', 'staff@hotel.com', 'guest@hotel.com');

-- 6. Insert official real users into auth.users (No ON CONFLICT needed)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@hotel.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Hotel Administrator","role":"ADMIN"}',
    now(),
    now(),
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'staff@hotel.com',
    crypt('staff123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Duty Staff Member","role":"STAFF"}',
    now(),
    now(),
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'guest@hotel.com',
    crypt('guest123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Customer Guest","role":"CUSTOMER"}',
    now(),
    now(),
    '',
    ''
  );

-- 7. Ensure corresponding profiles exist in public.profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', 'User'), 
  CASE 
    WHEN email LIKE '%admin%' THEN 'ADMIN'
    WHEN email LIKE '%staff%' THEN 'STAFF'
    ELSE 'CUSTOMER'
  END
FROM auth.users
WHERE email IN ('admin@hotel.com', 'staff@hotel.com', 'guest@hotel.com')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email;

SELECT 'Official user accounts created successfully!' AS status;
