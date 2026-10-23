import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { BedDouble, Users, Check } from 'lucide-react';
import type { Room } from '@/types/database';

export default function RoomCatalogPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{ roomId: string; checkIn: string; checkOut: string; guests: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const offline = isSupabaseOffline;

  useEffect(() => {
    async function loadRooms() {
      if (offline) {
        // Only use MockDB when genuinely offline (no real Supabase configured)
        setRooms(MockDB.getRooms().filter(r => r.status === 'AVAILABLE'));
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from('rooms').select('*').eq('status', 'AVAILABLE').order('room_number');
        if (error) throw error;
        // Use live data directly — even if empty (admin deleted all rooms)
        setRooms((data ?? []) as Room[]);
      } catch {
        // Only on a real network failure, fall back to mock
        setRooms(MockDB.getRooms().filter(r => r.status === 'AVAILABLE'));
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, [offline]);

  const nights = booking ? Math.max(1, Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000)) : 0;
  const selectedRoom = rooms.find(r => r.id === booking?.roomId);
  const totalPrice = selectedRoom ? selectedRoom.price_per_night * nights : 0;

  async function confirmBooking() {
    if (!booking || !profile || !selectedRoom) return;
    setSubmitting(true);

    if (offline || profile.id.startsWith('demo-')) {
      MockDB.addBooking({
        customer_id: profile.id,
        room_id: booking.roomId,
        check_in: booking.checkIn,
        check_out: booking.checkOut,
        guest_count: booking.guests,
        nights,
        total_price: totalPrice,
        status: 'CONFIRMED',
      });
      MockDB.updateRoom(booking.roomId, { status: 'OCCUPIED' });
      toast.success('Room booked successfully! (Demo mode)');
      setSubmitting(false);
      navigate('/dashboard');
      return;
    }

    try {
      const { error } = await supabase.from('bookings').insert({
        customer_id: profile.id,
        room_id: booking.roomId,
        check_in: booking.checkIn,
        check_out: booking.checkOut,
        guest_count: booking.guests,
        nights,
        total_price: totalPrice,
        status: 'CONFIRMED',
      });
      if (error) throw error;
      await supabase.from('rooms').update({ status: 'OCCUPIED' }).eq('id', booking.roomId);
      toast.success('Room booked successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-content"><p>Loading rooms…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Available Rooms</h1>
        <p>Choose your perfect room and book your stay.</p>
      </div>

      {booking && selectedRoom && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="card-body">
            <h3 style={{ marginBottom: '1rem' }}>Booking Summary — Room {selectedRoom.room_number}</h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Check-In Date</label>
                <input type="date" className="form-input" value={booking.checkIn} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setBooking(b => b && ({ ...b, checkIn: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Check-Out Date</label>
                <input type="date" className="form-input" value={booking.checkOut} min={booking.checkIn}
                  onChange={e => setBooking(b => b && ({ ...b, checkOut: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Guests</label>
                <input type="number" className="form-input" min={1} max={selectedRoom.capacity} value={booking.guests}
                  onChange={e => setBooking(b => b && ({ ...b, guests: Number(e.target.value) }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.25rem' }}>Total ({nights} nights)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8' }}>₹{totalPrice.toLocaleString()}</div>
                </div>
                <button className="btn btn-primary" onClick={confirmBooking} disabled={submitting || !booking.checkIn || !booking.checkOut}>
                  {submitting ? 'Booking…' : 'Confirm Booking'}
                </button>
                <button className="btn btn-secondary" onClick={() => setBooking(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {rooms.map(room => (
          <div key={room.id} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BedDouble size={48} color="white" opacity={0.7} />
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>Room {room.room_number}</h3>
                  <span className="badge badge-primary">{room.room_type}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1d4ed8' }}>₹{room.price_per_night.toLocaleString()}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>/night</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                <span><Users size={14} style={{ display: 'inline', marginRight: '4px' }} />{room.capacity} guests</span>
              </div>
              {room.amenities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {room.amenities.map(a => (
                    <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', background: '#f3f4f6', padding: '2px 8px', borderRadius: '9999px', color: '#374151' }}>
                      <Check size={11} />{a}
                    </span>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" style={{ width: '100%' }}
                onClick={() => setBooking({ roomId: room.id, checkIn: '', checkOut: '', guests: 1 })}>
                Book This Room
              </button>
            </div>
          </div>
        ))}
        {rooms.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <BedDouble size={48} style={{ margin: '0 auto 1rem' }} />
            <p>No rooms available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
