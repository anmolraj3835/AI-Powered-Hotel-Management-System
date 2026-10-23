import { create } from 'zustand';
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
  setRole: (role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  getRoleFromJWT: () => UserRole;
  clearAuth: () => void;
}

// Get saved role preference if available
const getSavedRole = (): UserRole => {
  try {
    const saved = localStorage.getItem('hotel_active_role');
    if (saved === 'ADMIN' || saved === 'STAFF' || saved === 'CUSTOMER') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'CUSTOMER';
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  role: getSavedRole(),
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),

  setSession: (session) => {
    let role: UserRole = get().role;
    if (session) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        const derived = normalizeRole((payload.app_role as string) || payload.role);
        if (derived) role = derived;
      } catch {
        // Fallback to current
      }
    }
    set({ session, role });
  },

  setProfile: (profile) =>
    set((state) => {
      const nextRole = profile?.role || state.role;
      try {
        localStorage.setItem('hotel_active_role', nextRole);
      } catch { /* ignore */ }
      return { profile, role: nextRole };
    }),

  setRole: (role: UserRole) => {
    try {
      localStorage.setItem('hotel_active_role', role);
    } catch { /* ignore */ }
    set((state) => ({
      role,
      profile: state.profile ? { ...state.profile, role } : null,
    }));
  },

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

  clearAuth: () =>
    set({
      user: null,
      session: null,
      profile: null,
      role: 'CUSTOMER',
      isLoading: false,
      isInitialized: true,
    }),
}));
