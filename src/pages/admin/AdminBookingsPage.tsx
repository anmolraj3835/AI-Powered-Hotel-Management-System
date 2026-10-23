import { useEffect, useState } from 'react';
import { supabase, isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import toast from 'react-hot-toast';
import type { Booking } from '@/types/database';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const offline = isSupabaseOffline;

  async function load() {
    if (offline) {
      setBookings(MockDB.getBookings() as Booking[]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase.from('bookings').select('*, rooms(room_number, room_type), profiles(full_name, email)').order('created_at', { ascending: false });
      const list = (data ?? []) as Booking[];
      setBookings(list.length > 0 ? list : (MockDB.getBookings() as Booking[]));
    } catch {
      setBookings(MockDB.getBookings() as Booking[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [offline]);

  async function updateStatus(id: string, status: string) {
    if (offline) {
      MockDB.updateBooking(id, { status: status as Booking['status'] });
      if (status === 'CHECKED_OUT') {
        const b = bookings.find(x => x.id === id);
        if (b) MockDB.updateRoom(b.room_id, { status: 'CLEANING' });
      }
      toast.success('Booking updated (Demo mode)');
      load();
      return;
    }

    const updates: Record<string, string> = { status, updated_at: new Date().toISOString() };
    if (status === 'CHECKED_OUT') {
      const b = bookings.find(x => x.id === id);
      if (b) await supabase.from('rooms').update({ status: 'CLEANING' }).eq('id', b.room_id);
    }
    const { error } = await supabase.from('bookings').update(updates).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Booking updated');
    load();
  }

  const statusColor: Record<string, string> = { PENDING: 'neutral', CONFIRMED: 'primary', CHECKED_IN: 'success', CHECKOUT_REQUESTED: 'warning', CHECKED_OUT: 'neutral', CANCELLED: 'danger' };

  if (loading) return <div className="page-content"><p>Loading bookings…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header"><h1>Booking Management</h1><p>Manage all guest bookings.</p></div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>Guest</th><th>Room</th><th>Check-In</th><th>Check-Out</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td><strong>{(b.profiles as { full_name?: string } | undefined)?.full_name ?? '—'}</strong><br /><span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{(b.profiles as { email?: string } | undefined)?.email ?? ''}</span></td>
                <td>{(b.rooms as { room_number?: string } | undefined)?.room_number ?? '—'}</td>
                <td>{new Date(b.check_in).toLocaleDateString()}</td>
                <td>{new Date(b.check_out).toLocaleDateString()}</td>
                <td>₹{b.total_price.toLocaleString()}</td>
                <td><span className={`badge badge-${statusColor[b.status] ?? 'neutral'}`}>{b.status}</span></td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {b.status === 'CONFIRMED'           && <button className="btn btn-sm btn-primary" onClick={() => updateStatus(b.id, 'CHECKED_IN')}>Check In</button>}
                  {b.status === 'CHECKOUT_REQUESTED'  && <button className="btn btn-sm btn-success" onClick={() => updateStatus(b.id, 'CHECKED_OUT')}>Check Out</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
