import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { Profile, ServiceRequest } from '@/types/database';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [pending, setPending] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const [sRes, rRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'STAFF').eq('is_active', true),
        supabase.from('service_requests').select('*').eq('status', 'PENDING').is('assigned_to', null),
      ]);
      setStaff((sRes.data ?? []) as Profile[]);
      setPending((rRes.data ?? []) as ServiceRequest[]);
      setLoading(false);
    }
    load();
  }, []);

  async function assign(requestId: string) {
    const staffId = selectedStaff[requestId];
    if (!staffId) { toast.error('Select a staff member first'); return; }
    setAssigning(requestId);
    const { error } = await supabase.from('service_requests').update({ assigned_to: staffId, status: 'IN_PROGRESS', updated_at: new Date().toISOString() }).eq('id', requestId);
    if (error) toast.error('Assignment failed');
    else { toast.success('Assigned successfully!'); setPending(prev => prev.filter(r => r.id !== requestId)); }
    setAssigning(null);
  }

  if (loading) return <div className="page-content"><p>Loading…</p></div>;

  return (
    <div className="page-content">
      <div className="page-header"><h1>Staff & Assignments</h1><p>Assign pending service requests to staff.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Staff Members ({staff.length})</span></div>
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th></tr></thead>
            <tbody>{staff.map(s => <tr key={s.id}><td><strong>{s.full_name}</strong></td><td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{s.email}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Unassigned Requests ({pending.length})</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pending.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center' }}>All requests assigned!</p>}
            {pending.map(r => (
              <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ marginBottom: '0.5rem' }}><strong>{r.title}</strong> &nbsp;<span className="badge badge-primary">{r.category}</span></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select className="form-select" style={{ flex: 1 }} value={selectedStaff[r.id] ?? ''} onChange={e => setSelectedStaff(prev => ({ ...prev, [r.id]: e.target.value }))}>
                    <option value="">Select staff…</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <button className="btn btn-sm btn-primary" onClick={() => assign(r.id)} disabled={assigning === r.id}>
                    {assigning === r.id ? '…' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
