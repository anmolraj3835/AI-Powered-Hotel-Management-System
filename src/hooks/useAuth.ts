import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole, type Profile } from '@/types/database';

async function resolveUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      const raw = data as Profile & { role: string };
      return { ...raw, role: normalizeRole(raw.role) };
    }

    // Fallback: build profile from Supabase auth user metadata
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.id === userId) {
      const emailLower = (user.email || '').toLowerCase();
      let derivedRole = user.user_metadata?.role;
      if (!derivedRole) {
        if (emailLower.includes('admin')) derivedRole = 'HOSTEL_ADMIN';
        else if (emailLower.includes('staff')) derivedRole = 'MAINTENANCE_STAFF';
        else derivedRole = 'STUDENT';
      }
      const normRole = normalizeRole(derivedRole);
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

      const fallbackProf: Profile = {
        id: user.id,
        email: user.email || '',
        full_name: fullName,
        role: normRole,
        phone: user.user_metadata?.phone || null,
        profile_picture_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return fallbackProf;
    }
  } catch (err) {
    console.error('Failed resolving profile:', err);
  }
  return null;
}

/** Run ONLY ONCE at the top-level App component */
export function useInitAuth() {
  const { setUser, setSession, setProfile, setLoading, setInitialized, clearAuth } = useAuthStore();

  const fetchProfile = useCallback(async (userId: string) => {
    const prof = await resolveUserProfile(userId);
    if (prof) setProfile(prof);
  }, [setProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          clearAuth();
        }
        setLoading(false);
        setInitialized(true);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, clearAuth, setInitialized, setLoading, setSession, setUser]);
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

  const fetchProfile = useCallback(async (userId: string) => {
    const prof = await resolveUserProfile(userId);
    if (prof) setProfile(prof);
  }, [setProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
  }, [clearAuth]);

  const isAdmin = role === 'ADMIN';
  const isStaff = role === 'STAFF';
  const isCustomer = role === 'CUSTOMER';

  const homePath = isAdmin ? '/admin' : isStaff ? '/staff' : '/dashboard';

  return {
    user, session, profile, role,
    isLoading, isInitialized,
    isAdmin, isStaff, isCustomer,
    homePath,
    signOut, fetchProfile,
  };
}
