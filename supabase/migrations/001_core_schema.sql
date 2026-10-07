-- ============================================================
-- Migration 001: Core Schema
-- AI-Powered Hostel Management System
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'STUDENT', 'WARDEN', 'HOSTEL_ADMIN', 'MAINTENANCE_STAFF', 'MESS_MANAGER', 'SUPER_ADMIN'
);

CREATE TYPE application_status AS ENUM (
  'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED'
);

CREATE TYPE room_type AS ENUM (
  'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'DORMITORY'
);

CREATE TYPE room_status AS ENUM (
  'ACTIVE', 'MAINTENANCE', 'BLOCKED', 'INACTIVE'
);

CREATE TYPE bed_status AS ENUM (
  'AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'BLOCKED'
);

CREATE TYPE complaint_status AS ENUM (
  'SUBMITTED', 'AI_ANALYZED', 'ASSIGNED', 'ACKNOWLEDGED',
  'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED', 'CANCELLED'
);

CREATE TYPE complaint_category AS ENUM (
  'INTERNET_WIFI', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'FURNITURE',
  'BATHROOM', 'WATER', 'AC_FAN', 'SECURITY', 'FOOD_MESS',
  'LAUNDRY', 'MAINTENANCE', 'NOISE', 'OTHER'
);

CREATE TYPE complaint_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE sentiment_type AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

CREATE TYPE sla_status AS ENUM ('ON_TIME', 'AT_RISK', 'BREACHED');

CREATE TYPE notice_category AS ENUM (
  'GENERAL', 'EMERGENCY', 'MAINTENANCE', 'MESS', 'FEE', 'HOLIDAY', 'RULES', 'EVENT'
);

CREATE TYPE notice_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE fee_type AS ENUM (
  'HOSTEL_FEE', 'MESS_FEE', 'MAINTENANCE', 'SECURITY_DEPOSIT', 'FINE', 'OTHER'
);

CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED', 'REFUNDED');

CREATE TYPE room_change_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  email TEXT NOT NULL,
  phone TEXT,
  course TEXT,
  department TEXT,
  year_of_study INTEGER CHECK (year_of_study BETWEEN 1 AND 6),
  semester INTEGER CHECK (semester BETWEEN 1 AND 12),
  gender gender_type,
  date_of_birth DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  emergency_contact TEXT,
  permanent_address TEXT,
  profile_picture_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HOSTELS
-- ============================================================

CREATE TABLE hostels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  gender gender_type NOT NULL,
  address TEXT,
  total_capacity INTEGER NOT NULL DEFAULT 0,
  warden_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  floors_count INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, code)
);

CREATE TABLE floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(block_id, floor_number)
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_type room_type NOT NULL DEFAULT 'DOUBLE',
  capacity INTEGER NOT NULL DEFAULT 2,
  status room_status NOT NULL DEFAULT 'ACTIVE',
  description TEXT,
  amenities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, room_number)
);

CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  status bed_status NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, bed_number)
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  complaint_categories complaint_category[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HOSTEL APPLICATIONS
-- ============================================================

CREATE TABLE hostel_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL,
  academic_year TEXT NOT NULL,
  preferred_hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL,
  preferred_room_type room_type,
  status application_status NOT NULL DEFAULT 'PENDING',
  emergency_info JSONB DEFAULT '{}',
  guardian_details JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROOM ALLOCATIONS
-- ============================================================

CREATE TABLE room_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  allocated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vacate_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  academic_year TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only one active allocation per student
  CONSTRAINT unique_active_student_allocation EXCLUDE USING btree (student_id WITH =) WHERE (is_active = true),
  -- Only one active allocation per bed
  CONSTRAINT unique_active_bed_allocation EXCLUDE USING btree (bed_id WITH =) WHERE (is_active = true)
);

-- ============================================================
-- ROOM CHANGE REQUESTS
-- ============================================================

CREATE TABLE room_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  requested_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status room_change_status NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPLAINTS
-- ============================================================

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number TEXT UNIQUE NOT NULL,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
  floor_id UUID REFERENCES floors(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category complaint_category NOT NULL DEFAULT 'OTHER',
  priority complaint_priority NOT NULL DEFAULT 'MEDIUM',
  status complaint_status NOT NULL DEFAULT 'SUBMITTED',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  -- SLA tracking
  sla_due_at TIMESTAMPTZ,
  sla_status sla_status DEFAULT 'ON_TIME',
  -- Flags
  is_escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate complaint number
CREATE SEQUENCE complaint_number_seq START 1000;
ALTER TABLE complaints ALTER COLUMN complaint_number SET DEFAULT 'COMP-' || LPAD(nextval('complaint_number_seq')::text, 6, '0');

-- ============================================================
-- COMPLAINT PREDICTIONS (AI)
-- ============================================================

CREATE TABLE complaint_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  -- Category prediction
  predicted_category complaint_category,
  category_confidence NUMERIC(5,4),
  category_review_required BOOLEAN NOT NULL DEFAULT false,
  category_corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category_correction_at TIMESTAMPTZ,
  -- Priority prediction
  predicted_priority complaint_priority,
  priority_confidence NUMERIC(5,4),
  priority_review_required BOOLEAN NOT NULL DEFAULT false,
  priority_corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority_correction_at TIMESTAMPTZ,
  -- Sentiment analysis
  predicted_sentiment sentiment_type,
  sentiment_confidence NUMERIC(5,4),
  -- Department assignment
  recommended_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  -- Model metadata
  model_version TEXT NOT NULL DEFAULT '1.0.0',
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_scores JSONB DEFAULT '{}',
  UNIQUE(complaint_id)
);

-- ============================================================
-- COMPLAINT STATUS HISTORY (immutable log)
-- ============================================================

CREATE TABLE complaint_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  previous_status complaint_status,
  new_status complaint_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPLAINT COMMENTS
-- ============================================================

CREATE TABLE complaint_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false, -- internal notes visible only to staff
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPLAINT ATTACHMENTS
-- ============================================================

CREATE TABLE complaint_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- path in Supabase Storage bucket
  file_name TEXT NOT NULL,    -- safe sanitized name
  original_name TEXT,          -- original filename for display
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- max 10MB
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FEEDBACK (post-resolution)
-- ============================================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  satisfaction_status TEXT CHECK (satisfaction_status IN ('SATISFIED', 'NEUTRAL', 'DISSATISFIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(complaint_id, student_id) -- prevent duplicate feedback
);

-- ============================================================
-- FEES
-- ============================================================

CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  fee_type fee_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  academic_year TEXT NOT NULL,
  semester TEXT,
  description TEXT,
  status payment_status NOT NULL DEFAULT 'PENDING',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_id UUID NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'OFFLINE',
  transaction_reference TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MESS MANAGEMENT
-- ============================================================

CREATE TABLE mess_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  menu_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER')),
  items JSONB NOT NULL DEFAULT '[]',
  is_special BOOLEAN NOT NULL DEFAULT false,
  special_occasion TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hostel_id, menu_date, meal_type)
);

CREATE TABLE mess_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES mess_menus(id) ON DELETE SET NULL,
  meal_type TEXT CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER')),
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, hostel_id, feedback_date, meal_type)
);

-- ============================================================
-- NOTICES
-- ============================================================

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel_id UUID REFERENCES hostels(id) ON DELETE CASCADE, -- NULL = all hostels
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category notice_category NOT NULL DEFAULT 'GENERAL',
  priority notice_priority NOT NULL DEFAULT 'NORMAL',
  target_role user_role, -- NULL = all roles
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  attachment_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO', -- INFO, SUCCESS, WARNING, ERROR
  entity_type TEXT, -- 'complaint', 'application', 'fee', 'notice', etc.
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS (immutable)
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STAFF TABLE
-- ============================================================

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES hostels(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE,
  designation TEXT,
  join_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
