import { supabase } from '@/lib/supabase';
import { normalizeRole, type Profile } from '@/types/database';

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    const raw = data as Profile & { role: string };
    return { ...raw, role: normalizeRole(raw.role) };
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { role: _role, id: _id, created_at: _ca, ...safeUpdates } = updates as Profile;
    void _role; void _id; void _ca;

    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates as never)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    const raw = data as Profile & { role: string };
    return { ...raw, role: normalizeRole(raw.role) };
  },

  async getStaffMembers(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['STAFF', 'MAINTENANCE_STAFF', 'MESS_MANAGER'])
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return ((data as unknown as Array<Profile & { role: string }>) || []).map((p) => ({
      ...p,
      role: normalizeRole(p.role),
    }));
  },
};
