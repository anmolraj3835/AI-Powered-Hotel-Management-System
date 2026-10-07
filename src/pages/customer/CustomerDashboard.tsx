import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { BedDouble, ClipboardList, Bell, CreditCard } from 'lucide-react';
import type { Booking, ServiceRequest } from '@/types/database';

export default function CustomerDashboard() {
  const { profile } = useAuth();
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      const [bookingRes, reqRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, rooms(*)')
          .eq('customer_id', profile.id)
          .in('status', ['CONFIRMED', 'CHECKED_IN'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('service_requests')
          .select('*')
          .eq('customer_id', profile.id)
          .neq('status', 'COMPLETED')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      setActiveBooking(bookingRes.data as Booking | null);
      setRequests((reqRes.data ?? []) as ServiceRequest[]);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <div className="page-loading">Loading your dashboard…</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Guest'} 👋</h1>
        <p>Here is your stay overview.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ '--stat-accent': '#2563eb', '--stat-bg': '#eff6ff' } as React.CSSProperties}>
          <div className="stat-card-icon"><BedDouble size={22} /></div>
          <div className="stat-card-value">{activeBooking ? `Room ${activeBooking.rooms?.room_number ?? '—'}` : 'No Active Stay'}</div>
          <div className="stat-card-label">Current Room</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#f59e0b', '--stat-bg': '#fffbeb' } as React.CSSProperties}>
          <div className="stat-card-icon"><ClipboardList size={22} /></div>
          <div className="stat-card-value">{requests.length}</div>
          <div className="stat-card-label">Open Requests</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#8b5cf6', '--stat-bg': '#f3e8ff' } as React.CSSProperties}>
          <div className="stat-card-icon"><CreditCard size={22} /></div>
          <div className="stat-card-value">{activeBooking ? `₹${activeBooking.total_price.toLocaleString()}` : '—'}</div>
          <div className="stat-card-label">Total Bill</div>
        </div>
      </div>

      {activeBooking ? (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title"><BedDouble size={18} /> Active Booking</span>
            <Link to="/bill" className="btn btn-sm btn-secondary">View Bill</Link>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div><strong>Room</strong><p>{activeBooking.rooms?.room_number} — {activeBooking.rooms?.room_type}</p></div>
              <div><strong>Check-In</strong><p>{new Date(activeBooking.check_in).toLocaleDateString()}</p></div>
              <div><strong>Check-Out</strong><p>{new Date(activeBooking.check_out).toLocaleDateString()}</p></div>
              <div><strong>Status</strong><p><span className="badge badge-success">{activeBooking.status}</span></p></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <BedDouble size={48} style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
          <h3>No active booking</h3>
          <p style={{ marginBottom: '1rem' }}>Browse available rooms and book your stay.</p>
          <Link to="/rooms" className="btn btn-primary">Browse Rooms</Link>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title"><Bell size={18} /> Recent Service Requests</span>
          <Link to="/requests/new" className="btn btn-sm btn-primary">+ New Request</Link>
        </div>
        <div className="card-body">
          {requests.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>No open requests.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td><span className="badge badge-primary">{r.category}</span></td>
                    <td><span className={`badge badge-${r.status === 'PENDING' ? 'warning' : 'info'}`}>{r.status}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
