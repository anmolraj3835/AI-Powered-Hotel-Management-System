import { supabase } from '@/lib/supabase';
import type {
  ServiceRequest,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@/types/database';

const TABLE = 'hotel_service_requests';

const CATEGORY_CHARGE: Record<ServiceRequestCategory, number> = {
  HOUSEKEEPING: 0,
  ROOM_SERVICE: 28,
  MAINTENANCE: 0,
  LAUNDRY: 18,
  OTHER: 0,
};

export const serviceRequestsService = {
  async createRequest(input: {
    booking_id?: string | null;
    room_id?: string | null;
    title: string;
    description: string;
    category: ServiceRequestCategory;
    priority: ServiceRequestPriority;
    ai_confidence?: number | null;
  }): Promise<ServiceRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        customer_id: user.id,
        booking_id: input.booking_id || null,
        room_id: input.room_id || null,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: 'PENDING',
        charge: CATEGORY_CHARGE[input.category] ?? 0,
        ai_confidence: input.ai_confidence ?? null,
      } as never)
      .select('*, rooms:hotel_rooms(*)')
      .single();
    if (error) throw error;
    return data as unknown as ServiceRequest;
  },

  async getUserRequests(userId: string): Promise<ServiceRequest[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as ServiceRequest[]) || [];
  },

  async getAssignedRequests(
    staffId: string,
    filters: { status?: ServiceRequestStatus | ''; category?: ServiceRequestCategory | '' } = {}
  ): Promise<ServiceRequest[]> {
    let query = supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*), profiles:profiles!hotel_service_requests_customer_id_fkey(id, full_name, email, phone)')
      .or(`assigned_to.eq.${staffId},assigned_to.is.null`)
      .order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase.from(TABLE).select('*, rooms:hotel_rooms(*)').order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data as unknown as ServiceRequest[]) || [];
    }
    return (data as unknown as ServiceRequest[]) || [];
  },

  async getAllRequests(): Promise<ServiceRequest[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as ServiceRequest[]) || [];
  },

  async updateStatus(
    id: string,
    status: ServiceRequestStatus,
    resolution_notes?: string
  ): Promise<ServiceRequest> {
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (resolution_notes !== undefined) payload.resolution_notes = resolution_notes;
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ServiceRequest;
  },

  async assignRequest(id: string, staffId: string): Promise<ServiceRequest> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ assigned_to: staffId, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ServiceRequest;
  },
};
