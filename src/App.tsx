import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth, useInitAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Auth pages — eagerly loaded (needed immediately on load)
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';

// Lazy-loaded pages (code-split by route)
const RegisterPage          = lazy(() => import('@/pages/auth/RegisterPage'));
const CustomerDashboard     = lazy(() => import('@/pages/customer/CustomerDashboard'));
const AdminDashboard        = lazy(() => import('@/pages/admin/AdminDashboard'));
const StaffDashboard        = lazy(() => import('@/pages/staff/StaffDashboard'));
const ProfilePage           = lazy(() => import('@/pages/ProfilePage'));
const RoomCatalogPage       = lazy(() => import('@/pages/customer/RoomCatalogPage'));
const NewServiceRequestPage = lazy(() => import('@/pages/customer/NewServiceRequestPage'));
const BillPage              = lazy(() => import('@/pages/customer/BillCheckoutPage'));
const NotificationsPage     = lazy(() => import('@/pages/NotificationsPage'));
const AdminRoomsPage        = lazy(() => import('@/pages/admin/AdminRoomsPage'));
const AdminBookingsPage     = lazy(() => import('@/pages/admin/AdminBookingsPage'));
const AdminStaffPage        = lazy(() => import('@/pages/admin/AdminStaffPage'));

// ── Route Guards ───────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized } = useAuth();
  if (!isInitialized || isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized, isAdmin } = useAuth();
  if (!isInitialized || isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized } = useAuth();
  if (!isInitialized || isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ── Offline Banner ─────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      You are offline. Some features may not be available.
    </div>
  );
}

// ── Dashboard redirect by role ─────────────────────────────────────────────
function DashboardRedirect() {
  const { isAdmin, isStaff } = useAuth();
  if (isAdmin)  return <AdminDashboard />;
  if (isStaff)  return <StaffDashboard />;
  return <CustomerDashboard />;
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  useInitAuth(); // initialise auth on mount once

  return (
    <BrowserRouter>
      <OfflineBanner />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* ── Public / Guest ─────────────────────────────────── */}
          <Route path="/login"           element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register"        element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />

          {/* ── Protected (authenticated) ──────────────────────── */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index                  element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"       element={<DashboardRedirect />} />
            <Route path="profile"         element={<ProfilePage />} />
            <Route path="notifications"   element={<NotificationsPage />} />

            {/* Customer routes */}
            <Route path="rooms"           element={<RoomCatalogPage />} />
            <Route path="requests/new"    element={<NewServiceRequestPage />} />
            <Route path="bill"            element={<BillPage />} />

            {/* Staff routes */}
            <Route path="staff"           element={<StaffDashboard />} />

            {/* Admin routes */}
            <Route path="admin">
              <Route index               element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="rooms"        element={<AdminRoute><AdminRoomsPage /></AdminRoute>} />
              <Route path="bookings"     element={<AdminRoute><AdminBookingsPage /></AdminRoute>} />
              <Route path="staff"        element={<AdminRoute><AdminStaffPage /></AdminRoute>} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
