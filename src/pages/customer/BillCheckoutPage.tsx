import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { bookingsService } from '@/services/bookings.service';
import { serviceRequestsService } from '@/services/serviceRequests.service';
import type { Booking, ServiceRequest } from '@/types/database';

export default function BillCheckoutPage() {
  const { user } = useAuth();
  const [stay, setStay] = useState<Booking | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const active = await bookingsService.getActiveStay(user.id);
      setStay(active);
      const all = await serviceRequestsService.getUserRequests(user.id);
      setRequests(active ? all.filter((r) => r.booking_id === active.id || r.room_id === active.room_id) : all);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load bill');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomCharge = stay ? Number(stay.total_price) : 0;
  const serviceCharge = requests.reduce((s, r) => s + Number(r.charge || 0), 0);
  const total = roomCharge + serviceCharge;

  const requestCheckout = async () => {
    if (!stay) return;
    try {
      await bookingsService.requestCheckout(stay.id);
      toast.success('Check-out requested. Front desk will confirm.');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Check-out failed');
    }
  };

  if (loading) return <p>Loading bill...</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Itemized bill</h3>
        </div>
        <div className="card-body">
          {!stay ? (
            <p>No active stay to bill. Book a room first.</p>
          ) : (
            <>
              <p>
                Room <strong>#{stay.rooms?.room_number}</strong> · {format(new Date(stay.check_in), 'MMM d')} – {format(new Date(stay.check_out), 'MMM d, yyyy')} · {stay.nights} night{stay.nights === 1 ? '' : 's'}
              </p>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Item</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Room charge ({stay.rooms?.room_type})</td>
                      <td>${roomCharge.toFixed(2)}</td>
                    </tr>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title} ({r.category.replace(/_/g, ' ')})</td>
                        <td>${Number(r.charge || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total due</strong></td>
                      <td><strong>${total.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 20 }}
                onClick={requestCheckout}
                disabled={stay.status === 'CHECKOUT_REQUESTED' || stay.status === 'CHECKED_OUT'}
              >
                {stay.status === 'CHECKOUT_REQUESTED' ? 'Check-out requested' : 'Request check-out'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
