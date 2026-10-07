import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { roomsService } from '@/services/rooms.service';
import type { Booking, BookingStatus } from '@/types/database';

const TABLE = 'hotel_bookings';

export function calculateNights(checkIn: string, checkOut: string): number {
  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
  return Math.max(nights, 1);
}

export const bookingsService = {
  async createBooking(input: {
    room_id: string;
    check_in: string;
    check_out: string;
    guest_count: number;
    total_price: number;
  }): Promise<Booking> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const nights = calculateNights(input.check_in, input.check_out);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        customer_id: user.id,
        room_id: input.room_id,
        check_in: input.check_in,
        check_out: input.check_out,
        guest_count: input.guest_count,
        nights,
        total_price: input.total_price,
        status: 'CONFIRMED',
      } as never)
      .select('*, rooms:hotel_rooms(*)')
      .single();
    if (error) throw error;
    return data as unknown as Booking;
  },

  async getUserBookings(userId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as Booking[]) || [];
  },

  async getActiveStay(userId: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*)')
      .eq('customer_id', userId)
      .in('status', ['CONFIRMED', 'CHECKED_IN', 'CHECKOUT_REQUESTED'])
      .order('check_in', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Booking) || null;
  },

  async getAllBookings(status?: BookingStatus | ''): Promise<Booking[]> {
    let query = supabase
      .from(TABLE)
      .select('*, rooms:hotel_rooms(*), profiles:profiles!hotel_bookings_customer_id_fkey(id, full_name, email, phone, role)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) {
      const fallback = await supabase
        .from(TABLE)
        .select('*, rooms:hotel_rooms(*)')
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      let rows = (fallback.data as unknown as Booking[]) || [];
      if (status) rows = rows.filter((b) => b.status === status);
      return rows;
    }
    return (data as unknown as Booking[]) || [];
  },

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq('id', id)
      .select('*, rooms:hotel_rooms(*)')
      .single();
    if (error) throw error;
    const booking = data as unknown as Booking;

    if (status === 'CHECKED_IN' && booking.room_id) {
      await roomsService.updateRoomStatus(booking.room_id, 'OCCUPIED');
    }
    if ((status === 'CHECKED_OUT' || status === 'CANCELLED') && booking.room_id) {
      await roomsService.updateRoomStatus(booking.room_id, status === 'CHECKED_OUT' ? 'CLEANING' : 'AVAILABLE');
    }
    return booking;
  },

  async requestCheckout(id: string): Promise<Booking> {
    return this.updateStatus(id, 'CHECKOUT_REQUESTED');
  },

  async checkIn(id: string): Promise<Booking> {
    return this.updateStatus(id, 'CHECKED_IN');
  },

  async checkOut(id: string): Promise<Booking> {
    return this.updateStatus(id, 'CHECKED_OUT');
  },
};
