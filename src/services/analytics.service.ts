import { roomsService } from '@/services/rooms.service';
import { bookingsService } from '@/services/bookings.service';
import { serviceRequestsService } from '@/services/serviceRequests.service';
import type { HotelAnalytics } from '@/types/database';

export const analyticsService = {
  async getHotelAnalytics(): Promise<HotelAnalytics> {
    const [rooms, bookings, requests] = await Promise.all([
      roomsService.getRooms(),
      bookingsService.getAllBookings(),
      serviceRequestsService.getAllRequests(),
    ]);

    const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length;
    const occupancyRate = rooms.length ? (occupied / rooms.length) * 100 : 0;

    const revenueBookings = bookings.filter((b) =>
      ['CONFIRMED', 'CHECKED_IN', 'CHECKOUT_REQUESTED', 'CHECKED_OUT'].includes(b.status)
    );
    const roomRevenue = revenueBookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
    const serviceRevenue = requests.reduce((sum, r) => sum + Number(r.charge || 0), 0);

    const activeGuests = bookings
      .filter((b) => b.status === 'CHECKED_IN')
      .reduce((sum, b) => sum + Number(b.guest_count || 0), 0);

    const openServiceRequests = requests.filter((r) => r.status !== 'COMPLETED').length;

    const requestsByCategory: Record<string, number> = {};
    requests.forEach((r) => {
      requestsByCategory[r.category] = (requestsByCategory[r.category] || 0) + 1;
    });

    const revenueByRoomType: Record<string, number> = {};
    revenueBookings.forEach((b) => {
      const type = b.rooms?.room_type || 'OTHER';
      revenueByRoomType[type] = (revenueByRoomType[type] || 0) + Number(b.total_price || 0);
    });

    return {
      totalRevenue: roomRevenue + serviceRevenue,
      occupancyRate,
      activeGuests,
      openServiceRequests,
      requestsByCategory,
      revenueByRoomType,
    };
  },
};
