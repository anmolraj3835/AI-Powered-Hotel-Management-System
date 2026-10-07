import clsx from 'clsx';
import type {
  BookingStatus,
  RoomStatus,
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@/types/database';

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const classes: Record<BookingStatus, string> = {
    PENDING: 'badge-neutral',
    CONFIRMED: 'badge-primary',
    CHECKED_IN: 'badge-success',
    CHECKOUT_REQUESTED: 'badge-warning',
    CHECKED_OUT: 'badge-closed',
    CANCELLED: 'badge-danger',
  };
  return <span className={clsx('badge', classes[status])}>{status.replace(/_/g, ' ')}</span>;
}

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const classes: Record<RoomStatus, string> = {
    AVAILABLE: 'badge-success',
    OCCUPIED: 'badge-danger',
    CLEANING: 'badge-warning',
    MAINTENANCE: 'badge-neutral',
  };
  return <span className={clsx('badge', classes[status])}>{status}</span>;
}

export function RequestStatusBadge({ status }: { status: ServiceRequestStatus }) {
  const classes: Record<ServiceRequestStatus, string> = {
    PENDING: 'badge-neutral',
    IN_PROGRESS: 'badge-in-progress',
    COMPLETED: 'badge-success',
  };
  return <span className={clsx('badge', classes[status])}>{status.replace(/_/g, ' ')}</span>;
}

export function PriorityBadge({ priority }: { priority: ServiceRequestPriority }) {
  const icons = { LOW: '↓', MEDIUM: '→', HIGH: '↑', CRITICAL: '⚠' };
  const classes: Record<ServiceRequestPriority, string> = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  };
  return (
    <span className={clsx('badge', classes[priority])}>
      {icons[priority]} {priority}
    </span>
  );
}

export function CategoryBadge({ category }: { category: ServiceRequestCategory }) {
  const labels: Record<ServiceRequestCategory, string> = {
    HOUSEKEEPING: 'Housekeeping',
    ROOM_SERVICE: 'Room Service',
    MAINTENANCE: 'Maintenance',
    LAUNDRY: 'Laundry',
    OTHER: 'Other',
  };
  return <span className="badge badge-primary">{labels[category]}</span>;
}

export function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: string }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
