export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';
export type DbUserRole =
  | UserRole
  | 'STUDENT'
  | 'WARDEN'
  | 'HOSTEL_ADMIN'
  | 'MAINTENANCE_STAFF'
  | 'MESS_MANAGER'
  | 'SUPER_ADMIN';

export type RoomType = 'SINGLE' | 'DOUBLE' | 'DELUXE' | 'SUITE';
export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKOUT_REQUESTED'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export type ServiceRequestCategory =
  | 'HOUSEKEEPING'
  | 'ROOM_SERVICE'
  | 'MAINTENANCE'
  | 'LAUNDRY'
  | 'OTHER';

export type ServiceRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type ServiceRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

/** Aliases used by the in-browser TF-IDF classifier */
export type ComplaintCategory = ServiceRequestCategory;
export type ComplaintPriority = ServiceRequestPriority;

export const ROOM_AMENITIES = ['WiFi', 'AC', 'TV', 'Jacuzzi', 'Ocean View'] as const;
export type RoomAmenity = (typeof ROOM_AMENITIES)[number];

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  profile_picture_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: RoomType;
  capacity: number;
  price_per_night: number;
  status: RoomStatus;
  description: string | null;
  amenities: string[];
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  nights: number;
  total_price: number;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  rooms?: Room;
  profiles?: Profile;
}

export interface ServiceRequest {
  id: string;
  customer_id: string;
  booking_id: string | null;
  room_id: string | null;
  title: string;
  description: string;
  category: ServiceRequestCategory;
  priority: ServiceRequestPriority;
  status: ServiceRequestStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  charge: number;
  ai_confidence: number | null;
  created_at: string;
  updated_at: string;
  rooms?: Room;
  profiles?: Profile;
  assigned_profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface HotelAnalytics {
  totalRevenue: number;
  occupancyRate: number;
  activeGuests: number;
  openServiceRequests: number;
  requestsByCategory: Record<string, number>;
  revenueByRoomType: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
    Views: {
      [key: string]: {
        Row: any;
      };
    };
    Functions: {
      [key: string]: {
        Args: any;
        Returns: any;
      };
    };
    Enums: {
      [key: string]: any;
    };
  };
}

export function normalizeRole(role: string | null | undefined): UserRole {
  const r = (role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'HOSTEL_ADMIN' || r === 'SUPER_ADMIN' || r === 'WARDEN') return 'ADMIN';
  if (r === 'STAFF' || r === 'MAINTENANCE_STAFF' || r === 'MESS_MANAGER') return 'STAFF';
  return 'CUSTOMER';
}

export function toDbRole(role: UserRole): string {
  if (role === 'ADMIN') return 'HOSTEL_ADMIN';
  if (role === 'STAFF') return 'MAINTENANCE_STAFF';
  return 'STUDENT';
}
