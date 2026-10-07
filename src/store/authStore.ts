import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import { normalizeRole, type Profile, type UserRole } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  getRoleFromJWT: () => UserRole;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      role: 'CUSTOMER',
      isLoading: true,
      isInitialized: false,

      setUser: (user) => set({ user }),
      setSession: (session) => {
        let role: UserRole = 'CUSTOMER';
        if (session) {
          try {
            const payload = JSON.parse(atob(session.access_token.split('.')[1]));
            role = normalizeRole((payload.app_role as string) || payload.role);
          } catch {
            role = 'CUSTOMER';
          }
        }
        set({ session, role });
      },
      setProfile: (profile) => set((state) => ({ profile, role: profile?.role || state.role })),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      getRoleFromJWT: () => {
        const { session } = get();
        if (!session) return 'CUSTOMER';
        try {
          const payload = JSON.parse(atob(session.access_token.split('.')[1]));
          return normalizeRole((payload.app_role as string) || payload.role);
        } catch {
          return 'CUSTOMER';
        }
      },

      clearAuth: () => set({
        user: null,
        session: null,
        profile: null,
        role: 'CUSTOMER',
        isLoading: false,
      }),
    }),
    {
      name: 'hotel-ai-auth',
      partialize: (state) => ({
        profile: state.profile,
        role: state.role,
      }),
    }
  )
);
