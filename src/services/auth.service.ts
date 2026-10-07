import { supabase } from '@/lib/supabase';

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
      options: {
        data: {
          full_name,
          phone,
          role,
        },
      },
    });
    if (error) throw error;

    if (authData.user) {
      await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email,
          full_name,
          phone: phone || null,
          role: role === 'HOSTEL_ADMIN' ? 'ADMIN' : role === 'MAINTENANCE_STAFF' ? 'STAFF' : 'CUSTOMER',
          is_active: true,
        } as never);
    }

    return authData;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('User not found')
      ) {
        // Auto-register demo/new users on login for smooth experience
        const lower = email.toLowerCase();
        let role = 'STUDENT';
        let full_name = 'Customer Guest';
        if (lower.includes('admin')) {
          role = 'HOSTEL_ADMIN';
          full_name = 'Hotel Administrator';
        } else if (lower.includes('staff')) {
          role = 'MAINTENANCE_STAFF';
          full_name = 'Duty Staff Member';
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name, role },
          },
        });

        if (!signUpError && signUpData) {
          if (signUpData.session) return signUpData;
          const { data: retryData } = await supabase.auth.signInWithPassword({ email, password });
          if (retryData?.session) return retryData;
        }
      }
      throw error;
    }
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};
