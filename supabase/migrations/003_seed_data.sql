-- ============================================================
-- Migration 003: Seed Data (Development Only)
-- AI-Powered Hostel Management System
-- ============================================================

-- NOTE: This is DEVELOPMENT SEED DATA ONLY
-- Do NOT run this in production environments
-- Demo accounts use test passwords and must be changed/removed before production

-- ============================================================
-- DEPARTMENTS
-- ============================================================

INSERT INTO departments (name, code, description, complaint_categories) VALUES
  ('IT & Network', 'IT', 'Handles internet, WiFi, and network issues', ARRAY['INTERNET_WIFI']::complaint_category[]),
  ('Electrical Maintenance', 'ELEC', 'Electrical wiring, power, fans, AC', ARRAY['ELECTRICAL', 'AC_FAN']::complaint_category[]),
  ('Plumbing', 'PLMB', 'Water supply, drainage, bathroom fixtures', ARRAY['PLUMBING', 'WATER', 'BATHROOM']::complaint_category[]),
  ('Housekeeping', 'HOUSE', 'Cleaning and sanitation', ARRAY['CLEANING']::complaint_category[]),
  ('Furniture & Carpentry', 'FURN', 'Furniture repair and replacement', ARRAY['FURNITURE']::complaint_category[]),
  ('Security', 'SEC', 'Campus and hostel security', ARRAY['SECURITY']::complaint_category[]),
  ('Mess Operations', 'MESS', 'Food quality and mess management', ARRAY['FOOD_MESS']::complaint_category[]),
  ('Laundry', 'LAUN', 'Laundry services', ARRAY['LAUNDRY']::complaint_category[]),
  ('General Maintenance', 'GEN', 'General repairs and maintenance', ARRAY['MAINTENANCE', 'NOISE', 'OTHER']::complaint_category[]);

-- ============================================================
-- SAMPLE HOSTELS
-- ============================================================

INSERT INTO hostels (name, code, gender, address, total_capacity, description) VALUES
  ('Tagore Hostel', 'TH', 'MALE', 'North Campus, Block A, University Road', 200, 'Main boys hostel with modern amenities'),
  ('Sarojini Hostel', 'SH', 'FEMALE', 'South Campus, Block B, University Road', 150, 'Girls hostel with 24/7 security'),
  ('Vivekananda Hostel', 'VH', 'MALE', 'East Campus, Block C', 180, 'Boys hostel near engineering block'),
  ('Kasturba Hostel', 'KH', 'FEMALE', 'West Campus, Block D', 120, 'Girls PG hostel');

-- ============================================================
-- BLOCKS, FLOORS, ROOMS, BEDS (for Tagore Hostel)
-- ============================================================

-- Blocks for Tagore Hostel
WITH th AS (SELECT id FROM hostels WHERE code = 'TH')
INSERT INTO blocks (hostel_id, name, code, floors_count)
SELECT th.id, 'Block A', 'A', 4 FROM th
UNION ALL SELECT th.id, 'Block B', 'B', 4 FROM th
UNION ALL SELECT th.id, 'Block C', 'C', 3 FROM th;

-- Floors for Block A of Tagore Hostel
WITH ba AS (SELECT b.id as block_id, h.id as hostel_id
            FROM blocks b JOIN hostels h ON b.hostel_id = h.id
            WHERE h.code = 'TH' AND b.code = 'A')
INSERT INTO floors (block_id, hostel_id, floor_number, name)
SELECT ba.block_id, ba.hostel_id, g.n, 'Floor ' || g.n FROM ba, generate_series(1, 4) AS g(n);

-- Rooms for Floor 1, Block A, Tagore Hostel (sample: 10 rooms)
WITH f1 AS (
  SELECT f.id as floor_id, b.id as block_id, h.id as hostel_id
  FROM floors f
  JOIN blocks b ON f.block_id = b.id
  JOIN hostels h ON b.hostel_id = h.id
  WHERE h.code = 'TH' AND b.code = 'A' AND f.floor_number = 1
)
INSERT INTO rooms (hostel_id, block_id, floor_id, room_number, room_type, capacity)
SELECT f1.hostel_id, f1.block_id, f1.floor_id, '1A' || LPAD(g.n::text, 2, '0'), 'DOUBLE', 2
FROM f1, generate_series(1, 10) AS g(n);

-- Beds for each room (2 beds per room)
INSERT INTO beds (room_id, hostel_id, bed_number)
SELECT r.id, r.hostel_id, bn.b
FROM rooms r
CROSS JOIN (VALUES ('A'), ('B')) AS bn(b)
WHERE r.hostel_id = (SELECT id FROM hostels WHERE code = 'TH')
AND r.room_number LIKE '1A%';

-- Similar setup for Sarojini Hostel
WITH sh AS (SELECT id FROM hostels WHERE code = 'SH')
INSERT INTO blocks (hostel_id, name, code, floors_count)
SELECT sh.id, 'Block A', 'A', 3 FROM sh
UNION ALL SELECT sh.id, 'Block B', 'B', 3 FROM sh;

WITH ba AS (SELECT b.id as block_id, h.id as hostel_id
            FROM blocks b JOIN hostels h ON b.hostel_id = h.id
            WHERE h.code = 'SH' AND b.code = 'A')
INSERT INTO floors (block_id, hostel_id, floor_number, name)
SELECT ba.block_id, ba.hostel_id, g.n, 'Floor ' || g.n FROM ba, generate_series(1, 3) AS g(n);

WITH f1 AS (
  SELECT f.id as floor_id, b.id as block_id, h.id as hostel_id
  FROM floors f
  JOIN blocks b ON f.block_id = b.id
  JOIN hostels h ON b.hostel_id = h.id
  WHERE h.code = 'SH' AND b.code = 'A' AND f.floor_number = 1
)
INSERT INTO rooms (hostel_id, block_id, floor_id, room_number, room_type, capacity)
SELECT f1.hostel_id, f1.block_id, f1.floor_id, '1A' || LPAD(g.n::text, 2, '0'), 'DOUBLE', 2
FROM f1, generate_series(1, 8) AS g(n);

INSERT INTO beds (room_id, hostel_id, bed_number)
SELECT r.id, r.hostel_id, bn.b
FROM rooms r
CROSS JOIN (VALUES ('A'), ('B')) AS bn(b)
WHERE r.hostel_id = (SELECT id FROM hostels WHERE code = 'SH')
AND r.room_number LIKE '1A%';

-- ============================================================
-- SAMPLE NOTICES
-- ============================================================

-- Note: These notices reference created_by which needs a real profile.
-- The admin account creation is handled via Supabase Auth + Edge Function.
-- Insert sample notices referencing a placeholder - update after first admin login.
-- These will be inserted with the seed admin script after auth setup.

-- ============================================================
-- SAMPLE MESS MENUS (current week)
-- ============================================================

-- To be inserted after hostel IDs are confirmed via the admin panel
-- Example format for reference:
/*
INSERT INTO mess_menus (hostel_id, menu_date, meal_type, items, created_by) VALUES
  ('HOSTEL_UUID', CURRENT_DATE, 'BREAKFAST', '["Idli", "Sambar", "Coconut Chutney", "Tea/Coffee"]', 'ADMIN_UUID'),
  ('HOSTEL_UUID', CURRENT_DATE, 'LUNCH', '["Rice", "Dal", "Rajma", "Salad", "Buttermilk"]', 'ADMIN_UUID'),
  ('HOSTEL_UUID', CURRENT_DATE, 'DINNER', '["Chapati", "Paneer Curry", "Rice", "Dal Tadka", "Pickle"]', 'ADMIN_UUID');
*/
