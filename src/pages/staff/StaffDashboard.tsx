import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';
import type { ServiceRequest } from '@/types/database';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase.from('service_requests').select('*, rooms(room_number)').eq('assigned_to', profile.id).neq('status', 'COMPLETED').order('created_at', { ascending: false })
      .then(({ data }) => { setRequests((data ?? []) as ServiceRequest[]); setLoading(false); });
  }, [profile]);

  async function updateStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED') {
    const { error } = await supabase.from('service_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r).filter(r => r.status !== 'COMPLETED'));
    toast.success(`Marked as ${status.replace('_', ' ')}`);
  }

  if (loading) return <div className="page-content"><p>Loading assignments…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header"><h1>Staff Dashboard</h1><p>Your assigned service requests.</p></div>
      <div className="card">
        <div className="card-header"><span className="card-title"><ClipboardList size={18} /> Assigned Requests ({requests.length})</span></div>
        {requests.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <ClipboardList size={48} style={{ margin: '0 auto 1rem' }} />
            <p>No pending assignments. Great work!</p>
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Title</th><th>Category</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.title}</strong><br /><span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{r.description.slice(0, 60)}…</span></td>
                  <td><span className="badge badge-primary">{r.category}</span></td>
                  <td>{(r.rooms as { room_number?: string } | undefined)?.room_number ?? '—'}</td>
                  <td><span className={`badge badge-${r.status === 'PENDING' ? 'warning' : 'info'}`}>{r.status}</span></td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    {r.status === 'PENDING' && <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(r.id, 'IN_PROGRESS')}>Start</button>}
                    {r.status === 'IN_PROGRESS' && <button className="btn btn-sm btn-success" onClick={() => updateStatus(r.id, 'COMPLETED')}>Mark Done</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
