import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole, type Profile, type UserRole } from '@/types/database';
import type { User } from '@supabase/supabase-js';

async function resolveUserProfile(user: User): Promise<Profile> {
  const emailLower = (user.email || '').toLowerCase();
  let defaultRole: UserRole = 'CUSTOMER';
  if (emailLower.includes('admin')) defaultRole = 'ADMIN';
  else if (emailLower.includes('staff')) defaultRole = 'STAFF';

  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      const raw = data as Profile & { role: string };
      return { ...raw, role: normalizeRole(raw.role) };
    }
  } catch (err) {
    console.warn('Profile fetch warning (using fallback):', err);
  }

  // Fallback: build profile directly from user object without additional network calls
  const derivedRole = user.user_metadata?.role ? normalizeRole(user.user_metadata.role) : defaultRole;
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  return {
    id: user.id,
    email: user.email || '',
    full_name: fullName,
    role: derivedRole,
    phone: user.user_metadata?.phone || null,
    profile_picture_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Run ONCE at top-level App component */
export function useInitAuth() {
  const { setUser, setSession, setProfile, setLoading, setInitialized, clearAuth } = useAuthStore.getState();

  useEffect(() => {
    let mounted = true;

    // Safety timeout: Never leave the user stuck on loading screen if network or DB hangs
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setInitialized(true);
      }
    }, 1200);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          const prof = await resolveUserProfile(session.user);
          if (mounted) setProfile(prof);
        } else {
          setUser(null);
          setSession(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          const prof = await resolveUserProfile(session.user);
          if (mounted) setProfile(prof);
        } else {
          clearAuth();
        }
        setLoading(false);
        setInitialized(true);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);
}

/** Pure hook for components to access auth state */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setRole = useAuthStore((s) => s.setRole);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors
    }
    clearAuth();
  }, [clearAuth]);

  const isAdmin = role === 'ADMIN';
  const isStaff = role === 'STAFF';
  const isCustomer = role === 'CUSTOMER';
  const homePath = isAdmin ? '/admin' : isStaff ? '/staff' : '/dashboard';

  const fetchProfile = useCallback(async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
      if (data) {
        setProfile(data as Profile);
      }
    } catch { /* ignore */ }
  }, [user, setProfile]);

  return {
    user,
    session,
    profile,
    role,
    isLoading,
    isInitialized,
    isAdmin,
    isStaff,
    isCustomer,
    homePath,
    setRole,
    signOut,
    setProfile,
    fetchProfile,
  };
}
