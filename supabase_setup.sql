-- ============================================================================
-- HOTEL & HOSTEL MANAGEMENT SYSTEM - CLEAN SETUP SQL (FIXED)
-- ============================================================================
-- Why this is needed:
-- An older schema already existed in your Supabase database with different columns.
-- This script safely cleans up the old conflicting tables and builds the clean,
-- modern schema required by the application.
--
-- Instructions:
-- 1. Open Supabase: https://supabase.com/dashboard
-- 2. Go to SQL Editor -> New Query
-- 3. Copy & paste this ENTIRE script -> Click "Run"
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CLEAN UP OLD CONFLICTING TABLES & VIEWS
-- ============================================================================

DROP VIEW IF EXISTS public.hotel_rooms CASCADE;
DROP VIEW IF EXISTS public.hotel_bookings CASCADE;
DROP VIEW IF EXISTS public.hotel_service_requests CASCADE;

-- Drop legacy hostel tables if they exist
DROP TABLE IF EXISTS public.beds CASCADE;
DROP TABLE IF EXISTS public.room_allocations CASCADE;
DROP TABLE IF EXISTS public.room_change_requests CASCADE;
DROP TABLE IF EXISTS public.complaint_activity_logs CASCADE;
DROP TABLE IF EXISTS public.complaint_feedback CASCADE;
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.hostel_applications CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.floors CASCADE;
DROP TABLE IF EXISTS public.blocks CASCADE;
DROP TABLE IF EXISTS public.hostels CASCADE;

-- Drop current tables to ensure fresh schema with proper columns
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.service_requests CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- ============================================================================
-- 3. PROFILES TABLE (Linked to auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'CUSTOMER', -- 'CUSTOMER', 'STAFF', 'ADMIN'
  full_name TEXT NOT NULL DEFAULT 'User',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  profile_picture_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure profiles has all expected columns even if it already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- 4. NEW FRESH ROOMS TABLE
-- ============================================================================

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'SINGLE', -- 'SINGLE', 'DOUBLE', 'DELUXE', 'SUITE'
  capacity INTEGER NOT NULL DEFAULT 1,
  price_per_night NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'
  description TEXT,
  amenities TEXT[] DEFAULT ARRAY['WiFi', 'AC']::TEXT[],
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. NEW FRESH BOOKINGS TABLE
-- ============================================================================

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  check_in DATE NOT NULL DEFAULT CURRENT_DATE,
  check_out DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
  guest_count INTEGER NOT NULL DEFAULT 1,
  nights INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKOUT_REQUESTED', 'CHECKED_OUT', 'CANCELLED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. NEW FRESH SERVICE REQUESTS TABLE
-- ============================================================================

CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER', -- 'HOUSEKEEPING', 'ROOM_SERVICE', 'MAINTENANCE', 'LAUNDRY', 'OTHER'
  priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ai_confidence NUMERIC(5, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  entity_type TEXT,
  entity_id TEXT,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. COMPATIBILITY VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.hotel_rooms AS SELECT * FROM public.rooms;
CREATE OR REPLACE VIEW public.hotel_bookings AS SELECT * FROM public.bookings;
CREATE OR REPLACE VIEW public.hotel_service_requests AS SELECT * FROM public.service_requests;

-- ============================================================================
-- 9. REALTIME PUBLICATION
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
  END IF;
END $$;

-- ============================================================================
-- 10. AUTH TRIGGER (Auto syncs auth.users -> public.profiles on registration)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_raw_role TEXT;
BEGIN
  v_raw_role := COALESCE(NEW.raw_user_meta_data->>'role', '');
  
  IF LOWER(v_raw_role) IN ('admin', 'hostel_admin', 'super_admin', 'warden') OR LOWER(NEW.email) LIKE '%admin%' THEN
    v_role := 'ADMIN';
  ELSIF LOWER(v_raw_role) IN ('staff', 'maintenance_staff', 'mess_manager') OR LOWER(NEW.email) LIKE '%staff%' THEN
    v_role := 'STAFF';
  ELSE
    v_role := 'CUSTOMER';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    role       = EXCLUDED.role,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies (Drop all old policies to eliminate any recursion)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Allow all profiles read" ON public.profiles
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow user update profile" ON public.profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow insert profile" ON public.profiles
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Allow admin manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rooms Policies
DROP POLICY IF EXISTS "Allow public read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow auth manage rooms" ON public.rooms;

CREATE POLICY "Allow public read rooms" ON public.rooms
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Allow auth manage rooms" ON public.rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bookings Policies
DROP POLICY IF EXISTS "Allow user read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow user insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow staff admin manage bookings" ON public.bookings;

CREATE POLICY "Allow user read bookings" ON public.bookings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow user insert bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id OR customer_id IS NOT NULL);

CREATE POLICY "Allow staff admin manage bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (true);

-- Service Requests Policies
DROP POLICY IF EXISTS "Allow user read service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow user insert service_requests" ON public.service_requests;
DROP POLICY IF EXISTS "Allow staff admin manage service_requests" ON public.service_requests;

CREATE POLICY "Allow user read service_requests" ON public.service_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow user insert service_requests" ON public.service_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id OR customer_id IS NOT NULL);

CREATE POLICY "Allow staff admin manage service_requests" ON public.service_requests
  FOR UPDATE TO authenticated USING (true);

-- Notifications Policies
DROP POLICY IF EXISTS "Allow user read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow user update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow insert notifications" ON public.notifications;

CREATE POLICY "Allow user read notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow user update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow insert notifications" ON public.notifications
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- ============================================================================
-- 12. INITIAL HOTEL ROOMS SEED
-- ============================================================================

INSERT INTO public.rooms (room_number, room_type, capacity, price_per_night, status, description, amenities, images)
VALUES
  ('101', 'SINGLE', 1, 1200.00, 'AVAILABLE', 'Comfortable single room with desk and high-speed Wi-Fi.', ARRAY['WiFi', 'AC'], ARRAY['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80']),
  ('102', 'DOUBLE', 2, 2200.00, 'AVAILABLE', 'Spacious double bed room, perfect for couples or friends.', ARRAY['WiFi', 'AC', 'TV'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80']),
  ('103', 'DOUBLE', 2, 2500.00, 'AVAILABLE', 'Quiet garden view double bedroom with tea/coffee maker.', ARRAY['WiFi', 'AC', 'TV'], ARRAY['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80']),
  ('201', 'DELUXE', 2, 3800.00, 'AVAILABLE', 'Premium deluxe suite with king bed and balcony view.', ARRAY['WiFi', 'AC', 'TV', 'Ocean View'], ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80']),
  ('202', 'DELUXE', 3, 4500.00, 'AVAILABLE', 'Triple deluxe room with modern amenities and bath tub.', ARRAY['WiFi', 'AC', 'TV', 'Ocean View'], ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80']),
  ('301', 'SUITE',  4, 7500.00, 'AVAILABLE', 'Executive luxury suite with jacuzzi, living room, and skyline view.', ARRAY['WiFi', 'AC', 'TV', 'Jacuzzi', 'Ocean View'], ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80'])
ON CONFLICT (room_number) DO UPDATE SET
  price_per_night = EXCLUDED.price_per_night,
  capacity        = EXCLUDED.capacity,
  amenities       = EXCLUDED.amenities;

SELECT 'HotelAI database setup completed successfully! Default rooms created.' AS result;
