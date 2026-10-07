import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { normalizeRole, type Profile } from '@/types/database';

export function useAuth() {
  const {
    user, session, profile, role, isLoading, isInitialized,
    setUser, setSession, setProfile, setLoading, setInitialized, clearAuth
  } = useAuthStore();

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
    supabase.auth.getSession().then(({ data: { session } }) => {
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

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
