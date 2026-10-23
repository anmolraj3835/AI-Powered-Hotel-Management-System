/**
 * Mock data store — used when Supabase is unreachable (paused/deleted project).
 * All mutations update this in-memory store so the UI stays consistent in a session.
 */
import type { Room, Booking, ServiceRequest, Profile, Notification } from '@/types/database';

// ── Seed Data ────────────────────────────────────────────────────────────────

export const mockStaff: Profile[] = [
  { id: 'staff-1', email: 'staff@hotel.com', full_name: 'Rahul Sharma', role: 'STAFF', phone: '+91 9876543210', profile_picture_url: null, is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'staff-2', email: 'priya@hotel.com', full_name: 'Priya Verma', role: 'STAFF', phone: '+91 9123456780', profile_picture_url: null, is_active: true, created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
];

export const mockRooms: Room[] = [
  { id: 'room-1', room_number: '101', room_type: 'SINGLE', capacity: 1, price_per_night: 1500, status: 'AVAILABLE', description: 'Cozy single room', amenities: ['WiFi', 'AC'], images: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'room-2', room_number: '102', room_type: 'DOUBLE', capacity: 2, price_per_night: 2500, status: 'OCCUPIED', description: 'Spacious double room', amenities: ['WiFi', 'AC', 'TV'], images: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'room-3', room_number: '201', room_type: 'DELUXE', capacity: 2, price_per_night: 4000, status: 'AVAILABLE', description: 'Deluxe room with view', amenities: ['WiFi', 'AC', 'TV', 'Ocean View'], images: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'room-4', room_number: '301', room_type: 'SUITE', capacity: 4, price_per_night: 8000, status: 'CLEANING', description: 'Luxury suite', amenities: ['WiFi', 'AC', 'TV', 'Jacuzzi', 'Ocean View'], images: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'room-5', room_number: '103', room_type: 'SINGLE', capacity: 1, price_per_night: 1200, status: 'AVAILABLE', description: 'Budget single', amenities: ['WiFi'], images: [], created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

export const mockBookings: Booking[] = [
  {
    id: 'booking-1', customer_id: 'demo-guest-id', room_id: 'room-2',
    check_in: '2026-10-20', check_out: '2026-10-25', guest_count: 2, nights: 5,
    total_price: 12500, status: 'CHECKED_IN', created_at: '2026-10-19T10:00:00Z', updated_at: '2026-10-20T10:00:00Z',
    rooms: mockRooms[1], profiles: { id: 'demo-guest-id', email: 'guest@hotel.com', full_name: 'Guest Traveler', role: 'CUSTOMER', phone: null, profile_picture_url: null, is_active: true, created_at: '', updated_at: '' },
  },
  {
    id: 'booking-2', customer_id: 'demo-guest-id', room_id: 'room-3',
    check_in: '2026-09-01', check_out: '2026-09-05', guest_count: 2, nights: 4,
    total_price: 16000, status: 'CHECKED_OUT', created_at: '2026-08-28T10:00:00Z', updated_at: '2026-09-05T10:00:00Z',
    rooms: mockRooms[2], profiles: { id: 'demo-guest-id', email: 'guest@hotel.com', full_name: 'Guest Traveler', role: 'CUSTOMER', phone: null, profile_picture_url: null, is_active: true, created_at: '', updated_at: '' },
  },
];

export const mockServiceRequests: ServiceRequest[] = [
  { id: 'req-1', customer_id: 'demo-guest-id', booking_id: 'booking-1', room_id: 'room-2', title: 'AC not working', description: 'The air conditioning is making noise', category: 'MAINTENANCE', priority: 'HIGH', status: 'IN_PROGRESS', assigned_to: 'staff-1', resolution_notes: null, charge: 0, ai_confidence: 0.92, created_at: '2026-10-21T09:00:00Z', updated_at: '2026-10-21T10:00:00Z' },
  { id: 'req-2', customer_id: 'demo-guest-id', booking_id: 'booking-1', room_id: 'room-2', title: 'Extra towels needed', description: 'Please send 2 more bath towels', category: 'HOUSEKEEPING', priority: 'LOW', status: 'PENDING', assigned_to: null, resolution_notes: null, charge: 0, ai_confidence: 0.88, created_at: '2026-10-22T14:00:00Z', updated_at: '2026-10-22T14:00:00Z' },
];

export const mockNotifications: Notification[] = [
  { id: 'notif-1', user_id: 'demo-guest-id', title: 'Booking Confirmed', message: 'Your booking for Room 102 has been confirmed.', type: 'SUCCESS', entity_type: 'booking', entity_id: 'booking-1', action_url: null, is_read: false, read_at: null, created_at: '2026-10-20T09:00:00Z' },
  { id: 'notif-2', user_id: 'demo-guest-id', title: 'Staff Assigned', message: 'Rahul Sharma is working on your maintenance request.', type: 'INFO', entity_type: 'service_request', entity_id: 'req-1', action_url: null, is_read: true, read_at: '2026-10-21T11:00:00Z', created_at: '2026-10-21T10:30:00Z' },
];

// ── Mutable state ─────────────────────────────────────────────────────────────
let _rooms = [...mockRooms];
let _bookings = [...mockBookings];
let _requests = [...mockServiceRequests];
let _staff = [...mockStaff];
let _notifications = [...mockNotifications];

let _nextId = 100;
function uid() { return `mock-${++_nextId}`; }

// ── Room CRUD ─────────────────────────────────────────────────────────────────
export const MockDB = {
  // Rooms
  getRooms: () => [..._rooms],
  addRoom: (room: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'description' | 'images'>) => {
    const r: Room = { ...room, id: uid(), description: null, images: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    _rooms = [..._rooms, r];
    return r;
  },
  updateRoom: (id: string, patch: Partial<Room>) => {
    _rooms = _rooms.map(r => r.id === id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r);
    return _rooms.find(r => r.id === id)!;
  },
  deleteRoom: (id: string) => { _rooms = _rooms.filter(r => r.id !== id); },

  // Bookings
  getBookings: () => _bookings.map(b => ({
    ...b,
    rooms: _rooms.find(r => r.id === b.room_id),
    profiles: _staff.find(s => s.id === b.customer_id) || mockBookings.find(x => x.id === b.id)?.profiles,
  })),
  updateBooking: (id: string, patch: Partial<Booking>) => {
    _bookings = _bookings.map(b => b.id === id ? { ...b, ...patch } : b);
  },
  getBookingsByCustomer: (customerId: string, statuses?: string[]) =>
    _bookings.filter(b => b.customer_id === customerId && (!statuses || statuses.includes(b.status)))
      .map(b => ({ ...b, rooms: _rooms.find(r => r.id === b.room_id) })),
  addBooking: (b: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => {
    const nb: Booking = { ...b, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    _bookings = [..._bookings, nb];
    return nb;
  },

  // Service Requests
  getRequests: () => [..._requests],
  getPendingUnassigned: () => _requests.filter(r => r.status === 'PENDING' && !r.assigned_to),
  getRequestsByCustomer: (customerId: string) => _requests.filter(r => r.customer_id === customerId),
  addRequest: (req: Omit<ServiceRequest, 'id' | 'created_at' | 'updated_at' | 'resolution_notes' | 'charge'>) => {
    const r: ServiceRequest = { ...req, id: uid(), resolution_notes: null, charge: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    _requests = [..._requests, r];
    return r;
  },
  assignRequest: (requestId: string, staffId: string) => {
    _requests = _requests.map(r => r.id === requestId ? { ...r, assigned_to: staffId, status: 'IN_PROGRESS', updated_at: new Date().toISOString() } : r);
  },
  updateRequest: (requestId: string, patch: Partial<ServiceRequest>) => {
    _requests = _requests.map(r => r.id === requestId ? { ...r, ...patch, updated_at: new Date().toISOString() } : r);
  },

  // Staff
  getStaff: () => [..._staff],
  addStaff: (s: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'profile_picture_url'>) => {
    const np: Profile = { ...s, id: uid(), profile_picture_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    _staff = [..._staff, np];
    return np;
  },
  removeStaff: (id: string) => { _staff = _staff.filter(s => s.id !== id); },

  // Notifications
  getNotifications: (userId: string) => _notifications.filter(n => n.user_id === userId || userId.startsWith('demo-')),
  markRead: (id: string) => { _notifications = _notifications.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n); },
  markAllRead: (userId: string) => { _notifications = _notifications.map(n => (n.user_id === userId || userId.startsWith('demo-')) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n); },

  // Analytics
  getStats: () => ({
    totalRooms: _rooms.length,
    occupiedRooms: _rooms.filter(r => r.status === 'OCCUPIED').length,
    activeGuests: _bookings.filter(b => ['CONFIRMED', 'CHECKED_IN'].includes(b.status)).length,
    openRequests: _requests.filter(r => r.status !== 'COMPLETED').length,
    totalRevenue: _bookings.filter(b => b.status === 'CHECKED_OUT').reduce((sum, b) => sum + b.total_price, 0),
  }),
};
