import { supabase } from '@/lib/supabase';
import type { Room, RoomStatus, RoomType } from '@/types/database';

const TABLE = 'hotel_rooms';

export interface RoomFilters {
  roomType?: RoomType | '';
  minCapacity?: number;
  minPrice?: number;
  maxPrice?: number;
  status?: RoomStatus | '';
}

export const DEFAULT_ROOM_IMAGES: Record<RoomType, string[]> = {
  SINGLE: [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80',
  ],
  DOUBLE: [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80',
  ],
  DELUXE: [
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80',
  ],
  SUITE: [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80',
  ],
};

export const roomsService = {
  async getRooms(filters: RoomFilters = {}): Promise<Room[]> {
    let query = supabase.from(TABLE).select('*').order('room_number');

    if (filters.roomType) query = query.eq('room_type', filters.roomType);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.minCapacity) query = query.gte('capacity', filters.minCapacity);
    if (filters.minPrice != null) query = query.gte('price_per_night', filters.minPrice);
    if (filters.maxPrice != null) query = query.lte('price_per_night', filters.maxPrice);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown as Room[]) || []).map(normalizeRoom);
  },

  async getRoom(id: string): Promise<Room | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeRoom(data as unknown as Room) : null;
  },

  async getHousekeepingRooms(): Promise<Room[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .in('status', ['CLEANING', 'MAINTENANCE'])
      .order('room_number');
    if (error) throw error;
    return ((data as unknown as Room[]) || []).map(normalizeRoom);
  },

  async updateRoomStatus(id: string, status: RoomStatus): Promise<Room> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return normalizeRoom(data as unknown as Room);
  },

  async createRoom(input: {
    room_number: string;
    room_type: RoomType;
    capacity: number;
    price_per_night: number;
    status?: RoomStatus;
    description?: string;
    amenities?: string[];
    images?: string[];
  }): Promise<Room> {
    const payload = {
      ...input,
      status: input.status || 'AVAILABLE',
      amenities: input.amenities || [],
      images: input.images?.length ? input.images : DEFAULT_ROOM_IMAGES[input.room_type],
    };
    const { data, error } = await supabase.from(TABLE).insert(payload as never).select().single();
    if (error) throw error;
    return normalizeRoom(data as unknown as Room);
  },

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
    const { id: _id, created_at: _ca, ...safe } = updates;
    void _id; void _ca;
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...safe, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return normalizeRoom(data as unknown as Room);
  },
};

function normalizeRoom(room: Room): Room {
  return {
    ...room,
    amenities: Array.isArray(room.amenities) ? room.amenities : [],
    images: Array.isArray(room.images) && room.images.length
      ? room.images
      : DEFAULT_ROOM_IMAGES[room.room_type] || DEFAULT_ROOM_IMAGES.SINGLE,
    price_per_night: Number(room.price_per_night),
    capacity: Number(room.capacity),
  };
}
