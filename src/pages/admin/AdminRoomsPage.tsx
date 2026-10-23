import { useEffect, useState } from 'react';
import { supabase, isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, WifiOff } from 'lucide-react';
import type { Room, RoomType, RoomStatus } from '@/types/database';

const ROOM_TYPES: RoomType[] = ['SINGLE', 'DOUBLE', 'DELUXE', 'SUITE'];
const ROOM_STATUSES: RoomStatus[] = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];

interface RoomForm {
  room_number: string;
  room_type: RoomType;
  capacity: number;
  price_per_night: number;
  status: RoomStatus;
}

const emptyForm: RoomForm = {
  room_number: '',
  room_type: 'SINGLE',
  capacity: 2,
  price_per_night: 1000,
  status: 'AVAILABLE',
};

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const offline = isSupabaseOffline;

  async function load() {
    try {
      if (offline) {
        setRooms(MockDB.getRooms());
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('rooms').select('*').order('room_number');
      if (error) throw error;
      setRooms((data ?? []) as Room[]);
    } catch (e) {
      console.error('Error loading rooms:', e);
      // Fallback to mock
      setRooms(MockDB.getRooms());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditRoom(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(r: Room) {
    setEditRoom(r);
    setForm({
      room_number: r.room_number,
      room_type: r.room_type,
      capacity: r.capacity,
      price_per_night: r.price_per_night,
      status: r.status,
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.room_number.trim()) {
      toast.error('Room number is required');
      return;
    }
    if (form.capacity < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }
    if (form.price_per_night < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    setSaving(true);
    try {
      if (offline) {
        // Use mock DB
        if (editRoom) {
          MockDB.updateRoom(editRoom.id, { ...form, capacity: Number(form.capacity), price_per_night: Number(form.price_per_night) });
          toast.success('Room updated (Demo mode)');
        } else {
          MockDB.addRoom({ ...form, capacity: Number(form.capacity), price_per_night: Number(form.price_per_night), amenities: ['WiFi', 'AC'] });
          toast.success('Room added (Demo mode)');
        }
        setShowModal(false);
        setRooms(MockDB.getRooms());
        return;
      }

      if (editRoom) {
        const { error } = await supabase.from('rooms').update({
          room_number: form.room_number.trim(),
          room_type: form.room_type,
          capacity: Number(form.capacity),
          price_per_night: Number(form.price_per_night),
          status: form.status,
          updated_at: new Date().toISOString(),
        }).eq('id', editRoom.id);
        if (error) throw error;
        toast.success('Room updated successfully');
      } else {
        const { error } = await supabase.from('rooms').insert({
          room_number: form.room_number.trim(),
          room_type: form.room_type,
          capacity: Number(form.capacity),
          price_per_night: Number(form.price_per_night),
          status: form.status,
          amenities: ['WiFi', 'AC'],
          image_url: null,
        });
        if (error) throw error;
        toast.success('Room added successfully');
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = err?.message || 'Save failed';
      if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
        // Retry with mock
        if (editRoom) {
          MockDB.updateRoom(editRoom.id, { ...form, capacity: Number(form.capacity), price_per_night: Number(form.price_per_night) });
          toast.success('Room updated (Demo mode — backend offline)');
        } else {
          MockDB.addRoom({ ...form, capacity: Number(form.capacity), price_per_night: Number(form.price_per_night), amenities: ['WiFi', 'AC'] });
          toast.success('Room added (Demo mode — backend offline)');
        }
        setShowModal(false);
        setRooms(MockDB.getRooms());
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoom(id: string) {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      if (offline) {
        MockDB.deleteRoom(id);
        setRooms(MockDB.getRooms());
        toast.success('Room deleted (Demo mode)');
        return;
      }
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
      toast.success('Room deleted');
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg = err?.message || 'Delete failed';
      if (msg.includes('fetch') || msg.includes('Failed')) {
        MockDB.deleteRoom(id);
        setRooms(MockDB.getRooms());
        toast.success('Room deleted (Demo mode)');
      } else {
        toast.error(msg);
      }
    }
  }

  const statusColor: Record<string, string> = {
    AVAILABLE: 'success',
    OCCUPIED: 'danger',
    CLEANING: 'warning',
    MAINTENANCE: 'neutral',
  };

  if (loading) return <div className="page-content"><p>Loading rooms…</p></div>;

  return (
    <div className="page-content">
      {offline && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WifiOff size={16} />
          <span><strong>Demo Mode</strong> — Supabase backend is offline. Changes are saved in memory only.</span>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>Room Management</h1>
          <p>Manage all hotel rooms.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Room
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th className="hide-mobile">Capacity</th>
              <th>Price/Night</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  No rooms added yet. Click "+ Add Room" to create one.
                </td>
              </tr>
            ) : (
              rooms.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.room_number}</strong></td>
                  <td><span className="badge badge-primary">{r.room_type}</span></td>
                  <td className="hide-mobile">{r.capacity} guest{r.capacity !== 1 ? 's' : ''}</td>
                  <td>₹{r.price_per_night.toLocaleString()}</td>
                  <td><span className={`badge badge-${statusColor[r.status] ?? 'neutral'}`}>{r.status}</span></td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)} title="Edit room">
                      <Edit size={14} /> <span className="portal-tab-label">Edit</span>
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => deleteRoom(r.id)} style={{ color: '#ef4444' }} title="Delete room">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editRoom ? 'Edit Room' : 'Add Room'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label required">Room Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. 101"
                  value={form.room_number}
                  onChange={(e) => setForm((p) => ({ ...p, room_number: e.target.value }))}
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={form.room_type}
                    onChange={(e) => setForm((p) => ({ ...p, room_type: e.target.value as RoomType }))}
                  >
                    {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1} max={10}
                    value={form.capacity}
                    onChange={(e) => setForm((p) => ({ ...p, capacity: +e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price / Night (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    value={form.price_per_night}
                    onChange={(e) => setForm((p) => ({ ...p, price_per_night: +e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as RoomStatus }))}
                  >
                    {ROOM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
