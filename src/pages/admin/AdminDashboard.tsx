import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BedDouble, Users, DollarSign, AlertTriangle } from 'lucide-react';

interface Stats {
  totalRooms: number;
  occupiedRooms: number;
  activeGuests: number;
  openRequests: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [roomsRes, bookingsRes, requestsRes] = await Promise.all([
        supabase.from('rooms').select('id, status'),
        supabase.from('bookings').select('id, total_price, status'),
        supabase.from('service_requests').select('id, status').neq('status', 'COMPLETED'),
      ]);
      const rooms = roomsRes.data ?? [];
      const bookings = bookingsRes.data ?? [];
      const reqs = requestsRes.data ?? [];
      setStats({
        totalRooms: rooms.length,
        occupiedRooms: rooms.filter((r: { status: string }) => r.status === 'OCCUPIED').length,
        activeGuests: bookings.filter((b: { status: string }) => ['CONFIRMED', 'CHECKED_IN'].includes(b.status)).length,
        openRequests: reqs.length,
        totalRevenue: bookings.filter((b: { status: string }) => b.status === 'CHECKED_OUT').reduce((sum: number, b: { total_price: number }) => sum + (b.total_price ?? 0), 0),
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="page-content"><p>Loading dashboard…</p></div>;

  const occupancyRate = stats ? Math.round((stats.occupiedRooms / Math.max(stats.totalRooms, 1)) * 100) : 0;

  return (
    <div className="page-content">
      <div className="page-header"><h1>Hotel Dashboard</h1><p>Overview of hotel operations.</p></div>
      <div className="stat-grid">
        <div className="stat-card" style={{ '--stat-accent': '#2563eb', '--stat-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="stat-card-icon"><BedDouble size={22} /></div>
          <div className="stat-card-value">{occupancyRate}%</div>
          <div className="stat-card-label">Occupancy Rate</div>
          <div className="stat-card-change">{stats?.occupiedRooms}/{stats?.totalRooms} rooms</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#22c55e', '--stat-bg': '#f0fdf4' } as React.CSSProperties}>
          <div className="stat-card-icon"><Users size={22} /></div>
          <div className="stat-card-value">{stats?.activeGuests}</div>
          <div className="stat-card-label">Active Guests</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#8b5cf6', '--stat-bg': '#f3e8ff' } as React.CSSProperties}>
          <div className="stat-card-icon"><DollarSign size={22} /></div>
          <div className="stat-card-value">₹{(stats?.totalRevenue ?? 0).toLocaleString()}</div>
          <div className="stat-card-label">Total Revenue</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#f59e0b', '--stat-bg': '#fffbeb' } as React.CSSProperties}>
          <div className="stat-card-icon"><AlertTriangle size={22} /></div>
          <div className="stat-card-value">{stats?.openRequests}</div>
          <div className="stat-card-label">Open Requests</div>
        </div>
      </div>
    </div>
  );
}
