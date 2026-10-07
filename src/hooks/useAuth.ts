import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole, type Profile } from '@/types/database';

/** Run ONLY ONCE at the top-level App component */
export function useInitAuth() {
  const { setUser, setSession, setProfile, setLoading, setInitialized, clearAuth } = useAuthStore();

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      const raw = data as Profile & { role: string };
      setProfile({ ...raw, role: normalizeRole(raw.role) });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      const raw = data as Profile & { role: string };
      setProfile({ ...raw, role: normalizeRole(raw.role) });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
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
