import { useEffect, useState } from 'react';
import { supabase, isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import { BedDouble, Users, DollarSign, AlertTriangle, WifiOff } from 'lucide-react';

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
  const offline = isSupabaseOffline;

  useEffect(() => {
    async function load() {
      if (offline) {
        setStats(MockDB.getStats());
        setLoading(false);
        return;
      }

      try {
        const [
          totalRoomsRes,
          occupiedRoomsRes,
          activeGuestsRes,
          openRequestsRes,
          revenueRes,
        ] = await Promise.all([
          supabase.from('rooms').select('*', { count: 'exact', head: true }),
          supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'OCCUPIED'),
          supabase.from('bookings').select('*', { count: 'exact', head: true }).in('status', ['CONFIRMED', 'CHECKED_IN']),
          supabase.from('service_requests').select('*', { count: 'exact', head: true }).neq('status', 'COMPLETED'),
          supabase.from('bookings').select('total_price').eq('status', 'CHECKED_OUT').limit(1000),
        ]);

        const totalRevenue = (revenueRes.data ?? []).reduce(
          (sum: number, b: { total_price: number }) => sum + (b.total_price ?? 0), 0
        );

        setStats({
          totalRooms:    totalRoomsRes.count    ?? 0,
          occupiedRooms: occupiedRoomsRes.count ?? 0,
          activeGuests:  activeGuestsRes.count  ?? 0,
          openRequests:  openRequestsRes.count  ?? 0,
          totalRevenue,
        });
      } catch {
        // Fallback to mock on any error
        setStats(MockDB.getStats());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [offline]);

  if (loading) return (
    <div className="page-content">
      <div className="page-header"><h1>Hotel Dashboard</h1><p>Overview of hotel operations.</p></div>
      <div className="stat-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ height: 22, width: 22, background: '#e5e7eb', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 32, width: '60%', background: '#e5e7eb', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ height: 14, width: '40%', background: '#f3f4f6', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );

  const occupancyRate = stats ? Math.round((stats.occupiedRooms / Math.max(stats.totalRooms, 1)) * 100) : 0;

  return (
    <div className="page-content">
      {offline && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WifiOff size={16} />
          <span><strong>Demo Mode</strong> — Showing sample data. Connect a Supabase project to use live data.</span>
        </div>
      )}
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
