-- ============================================================
-- Migration 002: Indexes, Functions, Triggers & RLS Policies
-- AI-Powered Hostel Management System
-- ============================================================

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_student_id ON profiles(student_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Hostels
CREATE INDEX idx_hostels_warden ON hostels(warden_id);

-- Rooms
CREATE INDEX idx_rooms_hostel ON rooms(hostel_id);
CREATE INDEX idx_rooms_block ON rooms(block_id);
CREATE INDEX idx_rooms_status ON rooms(status);

-- Beds
CREATE INDEX idx_beds_room ON beds(room_id);
CREATE INDEX idx_beds_hostel ON beds(hostel_id);
CREATE INDEX idx_beds_status ON beds(status);

-- Hostel Applications
CREATE INDEX idx_applications_student ON hostel_applications(student_id);
CREATE INDEX idx_applications_status ON hostel_applications(status);
CREATE INDEX idx_applications_hostel ON hostel_applications(hostel_id);
CREATE INDEX idx_applications_created ON hostel_applications(created_at DESC);

-- Room Allocations
CREATE INDEX idx_allocations_student ON room_allocations(student_id);
CREATE INDEX idx_allocations_room ON room_allocations(room_id);
CREATE INDEX idx_allocations_bed ON room_allocations(bed_id);
CREATE INDEX idx_allocations_active ON room_allocations(is_active) WHERE is_active = true;
CREATE INDEX idx_allocations_hostel ON room_allocations(hostel_id);

-- Complaints
CREATE INDEX idx_complaints_student ON complaints(student_id);
CREATE INDEX idx_complaints_hostel ON complaints(hostel_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_assigned ON complaints(assigned_to);
CREATE INDEX idx_complaints_department ON complaints(department_id);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX idx_complaints_sla ON complaints(sla_due_at) WHERE status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED');
-- Full text search index
CREATE INDEX idx_complaints_fts ON complaints USING gin(to_tsvector('english', title || ' ' || description));

-- Complaint comments
CREATE INDEX idx_comments_complaint ON complaint_comments(complaint_id);
CREATE INDEX idx_comments_user ON complaint_comments(user_id);

-- Complaint status history
CREATE INDEX idx_status_history_complaint ON complaint_status_history(complaint_id);
CREATE INDEX idx_status_history_created ON complaint_status_history(created_at DESC);

-- Complaint attachments
CREATE INDEX idx_attachments_complaint ON complaint_attachments(complaint_id);

-- Feedback
CREATE INDEX idx_feedback_complaint ON feedback(complaint_id);
CREATE INDEX idx_feedback_student ON feedback(student_id);

-- Fees
CREATE INDEX idx_fees_student ON fees(student_id);
CREATE INDEX idx_fees_hostel ON fees(hostel_id);
CREATE INDEX idx_fees_status ON fees(status);
CREATE INDEX idx_fees_due ON fees(due_date);

-- Payments
CREATE INDEX idx_payments_fee ON payments(fee_id);
CREATE INDEX idx_payments_student ON payments(student_id);

-- Notices
CREATE INDEX idx_notices_hostel ON notices(hostel_id);
CREATE INDEX idx_notices_category ON notices(category);
CREATE INDEX idx_notices_published ON notices(is_published, expires_at);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Audit logs
CREATE INDEX idx_audit_performer ON audit_logs(performed_by);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- Mess menus
CREATE INDEX idx_mess_menus_hostel_date ON mess_menus(hostel_id, menu_date);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_beds_updated_at BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fees_updated_at BEFORE UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notices_updated_at BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON hostel_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_allocations_updated_at BEFORE UPDATE ON room_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'STUDENT')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-calculate SLA due date when complaint is inserted
CREATE OR REPLACE FUNCTION set_sla_due_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sla_due_at = CASE NEW.priority
    WHEN 'CRITICAL' THEN NEW.created_at + INTERVAL '4 hours'
    WHEN 'HIGH'     THEN NEW.created_at + INTERVAL '24 hours'
    WHEN 'MEDIUM'   THEN NEW.created_at + INTERVAL '72 hours'
    WHEN 'LOW'      THEN NEW.created_at + INTERVAL '168 hours'
    ELSE                  NEW.created_at + INTERVAL '72 hours'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complaint_sla
  BEFORE INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION set_sla_due_date();

-- Auto-log complaint status changes
CREATE OR REPLACE FUNCTION log_complaint_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO complaint_status_history (complaint_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_complaint_status_history
  AFTER UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION log_complaint_status_change();

-- Update bed status when allocation changes
CREATE OR REPLACE FUNCTION sync_bed_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    UPDATE beds SET status = 'OCCUPIED' WHERE id = NEW.bed_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE beds SET status = 'AVAILABLE' WHERE id = NEW.bed_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_bed_status
  AFTER INSERT OR UPDATE ON room_allocations
  FOR EACH ROW EXECUTE FUNCTION sync_bed_status();

-- ============================================================
-- CUSTOM JWT CLAIMS HOOK (inject role into JWT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_profile_role user_role;
BEGIN
  SELECT role INTO user_profile_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  IF user_profile_role IS NULL THEN
    user_profile_role := 'STUDENT'::user_role;
  END IF;

  claims := event->'claims';
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_profile_role::text));
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================
-- HELPER FUNCTION: Get current user role from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (auth.jwt() ->> 'app_role')),
    'STUDENT'
  );
$$;

-- ============================================================
-- ANALYTICS RPC FUNCTIONS (for dashboard — server-side aggregation)
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_analytics(p_hostel_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_students', (
      SELECT COUNT(*) FROM profiles WHERE role = 'STUDENT' AND is_active = true
    ),
    'total_hostels', (
      SELECT COUNT(*) FROM hostels WHERE is_active = true
    ),
    'total_rooms', (
      SELECT COUNT(*) FROM rooms
      WHERE (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'total_beds', (
      SELECT COUNT(*) FROM beds
      WHERE (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'occupied_beds', (
      SELECT COUNT(*) FROM beds
      WHERE status = 'OCCUPIED'
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'available_beds', (
      SELECT COUNT(*) FROM beds
      WHERE status = 'AVAILABLE'
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'total_complaints', (
      SELECT COUNT(*) FROM complaints
      WHERE (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'pending_complaints', (
      SELECT COUNT(*) FROM complaints
      WHERE status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'resolved_complaints', (
      SELECT COUNT(*) FROM complaints
      WHERE status IN ('RESOLVED', 'CLOSED')
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'critical_complaints', (
      SELECT COUNT(*) FROM complaints
      WHERE priority = 'CRITICAL' AND status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'sla_breached', (
      SELECT COUNT(*) FROM complaints
      WHERE sla_due_at < now() AND status NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'avg_resolution_hours', (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric, 1)
      FROM complaints
      WHERE resolved_at IS NOT NULL
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    ),
    'complaints_by_category', (
      SELECT jsonb_object_agg(category, cnt)
      FROM (
        SELECT category, COUNT(*) as cnt FROM complaints
        WHERE (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
        GROUP BY category
      ) t
    ),
    'complaints_by_priority', (
      SELECT jsonb_object_agg(priority, cnt)
      FROM (
        SELECT priority, COUNT(*) as cnt FROM complaints
        WHERE (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
        GROUP BY priority
      ) t
    ),
    'avg_satisfaction', (
      SELECT ROUND(AVG(rating)::numeric, 2) FROM feedback
    ),
    'pending_fees', (
      SELECT COALESCE(SUM(amount), 0) FROM fees
      WHERE status = 'PENDING'
      AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Complaints trend (last 30 days)
CREATE OR REPLACE FUNCTION get_complaints_trend(p_hostel_id UUID DEFAULT NULL, p_days INTEGER DEFAULT 30)
RETURNS TABLE(date DATE, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    date_trunc('day', created_at)::date AS date,
    COUNT(*) AS count
  FROM complaints
  WHERE created_at >= now() - (p_days || ' days')::interval
  AND (p_hostel_id IS NULL OR hostel_id = p_hostel_id)
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mess_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE mess_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF', 'MESS_MANAGER')
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()) AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- HOSTELS (public read, admin write)
CREATE POLICY "hostels_read" ON hostels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hostels_write" ON hostels
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- BLOCKS, FLOORS (public read, admin write)
CREATE POLICY "blocks_read" ON blocks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocks_write" ON blocks
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "floors_read" ON floors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "floors_write" ON floors
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- ROOMS
CREATE POLICY "rooms_read" ON rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_write" ON rooms
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'WARDEN', 'SUPER_ADMIN'));

-- BEDS
CREATE POLICY "beds_read" ON beds
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "beds_write" ON beds
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'WARDEN', 'SUPER_ADMIN'));

-- DEPARTMENTS (public read, admin write)
CREATE POLICY "departments_read" ON departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write" ON departments
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- HOSTEL APPLICATIONS
CREATE POLICY "applications_student_read" ON hostel_applications
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "applications_student_insert" ON hostel_applications
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY "applications_admin_update" ON hostel_applications
  FOR UPDATE TO authenticated
  USING (
    (student_id = (SELECT auth.uid()) AND status = 'PENDING')
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

-- ROOM ALLOCATIONS
CREATE POLICY "allocations_read" ON room_allocations
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF')
  );

CREATE POLICY "allocations_write" ON room_allocations
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- ROOM CHANGE REQUESTS
CREATE POLICY "room_change_read" ON room_change_requests
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "room_change_insert" ON room_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY "room_change_admin_update" ON room_change_requests
  FOR UPDATE TO authenticated
  USING ((SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- STAFF
CREATE POLICY "staff_read" ON staff
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN')
  );
CREATE POLICY "staff_write" ON staff
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- COMPLAINTS
CREATE POLICY "complaints_read" ON complaints
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR assigned_to = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF')
  );

CREATE POLICY "complaints_insert" ON complaints
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY "complaints_student_update" ON complaints
  FOR UPDATE TO authenticated
  USING (
    (student_id = (SELECT auth.uid()) AND status IN ('SUBMITTED', 'RESOLVED'))
    OR assigned_to = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF')
  );

-- COMPLAINT PREDICTIONS
CREATE POLICY "predictions_read" ON complaint_predictions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM complaints c WHERE c.id = complaint_id
      AND (c.student_id = (SELECT auth.uid()) OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'))
    )
  );

CREATE POLICY "predictions_write" ON complaint_predictions
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN', 'WARDEN', 'MAINTENANCE_STAFF'));

-- COMPLAINT STATUS HISTORY
CREATE POLICY "status_history_read" ON complaint_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM complaints c WHERE c.id = complaint_id
      AND (c.student_id = (SELECT auth.uid()) OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'))
    )
  );

-- COMPLAINT COMMENTS
CREATE POLICY "comments_read" ON complaint_comments
  FOR SELECT TO authenticated
  USING (
    (NOT is_internal AND EXISTS (
      SELECT 1 FROM complaints c WHERE c.id = complaint_id
      AND (c.student_id = (SELECT auth.uid()) OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'))
    ))
    OR (is_internal AND (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'))
  );

CREATE POLICY "comments_insert" ON complaint_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM complaints c WHERE c.id = complaint_id
      AND (c.student_id = (SELECT auth.uid()) OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'))
    )
    AND (
      NOT is_internal  -- students can't create internal notes
      OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF')
    )
  );

-- COMPLAINT ATTACHMENTS
CREATE POLICY "attachments_read" ON complaint_attachments
  FOR SELECT TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF')
  );

CREATE POLICY "attachments_insert" ON complaint_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = (SELECT auth.uid()));

-- FEEDBACK
CREATE POLICY "feedback_read" ON feedback
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "feedback_insert" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM complaints c WHERE c.id = complaint_id
      AND c.student_id = (SELECT auth.uid())
      AND c.status IN ('RESOLVED', 'CLOSED')
    )
  );

-- FEES
CREATE POLICY "fees_student_read" ON fees
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "fees_admin_write" ON fees
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- PAYMENTS
CREATE POLICY "payments_read" ON payments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "payments_admin_write" ON payments
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- MESS MENUS (public read, mess manager write)
CREATE POLICY "mess_menus_read" ON mess_menus
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mess_menus_write" ON mess_menus
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('MESS_MANAGER', 'HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- MESS FEEDBACK
CREATE POLICY "mess_feedback_read" ON mess_feedback
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('MESS_MANAGER', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "mess_feedback_insert" ON mess_feedback
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()));

-- NOTICES (public read, authorized write)
CREATE POLICY "notices_read" ON notices
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (target_role IS NULL OR target_role = (SELECT role FROM profiles WHERE id = auth.uid()))
    OR (SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN')
  );

CREATE POLICY "notices_write" ON notices
  FOR ALL TO authenticated
  USING ((SELECT auth_role()) IN ('WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN'));

-- NOTIFICATIONS (user sees only own)
CREATE POLICY "notifications_read" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admin/system can insert notifications for any user
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN', 'WARDEN')
  );

-- AUDIT LOGS (admin read-only, system inserts)
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT TO authenticated
  USING ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN'));

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth_role()) IN ('HOSTEL_ADMIN', 'SUPER_ADMIN', 'WARDEN', 'MAINTENANCE_STAFF'));
