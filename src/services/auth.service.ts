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
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
          role: 'STUDENT',
        },
      },
    });
    if (error) throw error;

    if (authData.user) {
      await supabase
        .from('profiles')
        .update({ phone, full_name } as never)
        .eq('id', authData.user.id);
    }

    return authData;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
