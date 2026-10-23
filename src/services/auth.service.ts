import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export const authService = {
  async register(data: RegisterData) {
    const { email, password, full_name, phone } = data;
    const lower = email.toLowerCase();
    let role = 'STUDENT';
    if (lower.includes('admin')) role = 'HOSTEL_ADMIN';
    else if (lower.includes('staff')) role = 'MAINTENANCE_STAFF';

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name, phone, role } },
    });

    if (error && !error.message.includes('User already registered')) {
      throw error;
    }

    return authData;
  },

  async login(email: string, password: string) {
    // Single attempt — no fallback signup. If login fails, throw immediately.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Provide a friendly message for common errors
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      if (error.message.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please verify your email address before signing in');
      }
      throw new Error(error.message);
    }

    if (!data?.session) {
      throw new Error('Login failed — no session returned');
    }

    return data;
  },

  quickDemoLogin(role: 'ADMIN' | 'STAFF' | 'CUSTOMER') {
    const store = useAuthStore.getState();
    const isAdm = role === 'ADMIN';
    const isStf = role === 'STAFF';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser: any = {
      id: isAdm ? 'demo-admin-id' : isStf ? 'demo-staff-id' : 'demo-guest-id',
      email: isAdm ? 'admin@hotel.com' : isStf ? 'staff@hotel.com' : 'guest@hotel.com',
      app_metadata: {},
      user_metadata: {
        role,
        full_name: isAdm ? 'Hotel Administrator' : isStf ? 'Operations Staff' : 'Guest Traveler',
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    store.setUser(mockUser);
    store.setRole(role);
    store.setProfile({
      id: mockUser.id,
      email: mockUser.email,
      full_name: mockUser.user_metadata.full_name,
      role,
      phone: '+1 555-0199',
      profile_picture_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    store.setLoading(false);
    store.setInitialized(true);
  },

  async logout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out errors
    }
    useAuthStore.getState().clearAuth();
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getSession() {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session;
    } catch {
      return null;
    }
  },
};
