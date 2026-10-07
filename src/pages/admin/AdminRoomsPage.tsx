import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Edit } from 'lucide-react';
import type { Room, RoomType, RoomStatus } from '@/types/database';

const ROOM_TYPES: RoomType[] = ['SINGLE', 'DOUBLE', 'DELUXE', 'SUITE'];
const ROOM_STATUSES: RoomStatus[] = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];

interface RoomForm { room_number: string; room_type: RoomType; capacity: number; price_per_night: number; status: RoomStatus; }
const emptyForm: RoomForm = { room_number: '', room_type: 'SINGLE', capacity: 2, price_per_night: 100, status: 'AVAILABLE' };

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('rooms').select('*').order('room_number');
    setRooms((data ?? []) as Room[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditRoom(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(r: Room) { setEditRoom(r); setForm({ room_number: r.room_number, room_type: r.room_type, capacity: r.capacity, price_per_night: r.price_per_night, status: r.status }); setShowModal(true); }

  async function save() {
    setSaving(true);
    try {
      if (editRoom) {
        const { error } = await supabase.from('rooms').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editRoom.id);
        if (error) throw error;
        toast.success('Room updated');
      } else {
        const { error } = await supabase.from('rooms').insert({ ...form, amenities: [], images: [] });
        if (error) throw error;
        toast.success('Room added');
      }
      setShowModal(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const statusColor: Record<string, string> = { AVAILABLE: 'success', OCCUPIED: 'danger', CLEANING: 'warning', MAINTENANCE: 'neutral' };

  if (loading) return <div className="page-content"><p>Loading rooms…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Room Management</h1><p>Manage all hotel rooms.</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Room</button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead><tr><th>Room</th><th>Type</th><th>Capacity</th><th>Price/Night</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rooms.map(r => (
              <tr key={r.id}>
                <td><strong>{r.room_number}</strong></td>
                <td><span className="badge badge-primary">{r.room_type}</span></td>
                <td>{r.capacity} guests</td>
                <td>₹{r.price_per_night.toLocaleString()}</td>
                <td><span className={`badge badge-${statusColor[r.status] ?? 'neutral'}`}>{r.status}</span></td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}><Edit size={14} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editRoom ? 'Edit Room' : 'Add Room'}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group"><label className="form-label required">Room Number</label><input className="form-input" value={form.room_number} onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} /></div>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value as RoomType }))}>{ROOM_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Capacity</label><input type="number" className="form-input" min={1} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: +e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Price / Night (₹)</label><input type="number" className="form-input" min={0} value={form.price_per_night} onChange={e => setForm(p => ({ ...p, price_per_night: +e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as RoomStatus }))}>{ROOM_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
