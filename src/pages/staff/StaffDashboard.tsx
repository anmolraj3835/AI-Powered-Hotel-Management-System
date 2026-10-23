import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import toast from 'react-hot-toast';
import { ClipboardList, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { ServiceRequest } from '@/types/database';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!profile) return;

    if (isSupabaseOffline) {
      setRequests(MockDB.getRequests().filter(r => r.status !== 'COMPLETED') as ServiceRequest[]);
      setLoading(false);
      return;
    }

    try {
      // Show ALL pending/in-progress requests — both unassigned and assigned to this staff
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          rooms(room_number),
          profiles!service_requests_customer_id_fkey(full_name)
        `)
        .neq('status', 'COMPLETED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data ?? []) as ServiceRequest[]);
    } catch {
      setRequests(MockDB.getRequests().filter(r => r.status !== 'COMPLETED') as ServiceRequest[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    load();

    // Realtime subscription for new service requests
    const channel = supabase
      .channel('staff-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'service_requests',
      }, () => { load(); })
      .subscribe();

    // Poll every 15 seconds as a fallback
    intervalRef.current = setInterval(load, 15000);

    return () => {
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function claimRequest(id: string) {
    if (!profile) return;
    if (isSupabaseOffline) {
      MockDB.assignRequest(id, profile.id);
      toast.success('Request claimed!');
      load();
      return;
    }
    const { error } = await supabase.from('service_requests').update({
      assigned_to: profile.id,
      status: 'IN_PROGRESS',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Failed to claim'); return; }
    toast.success('Request claimed — marked as In Progress');
    load();
  }

  async function updateStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED') {
    if (isSupabaseOffline) {
      MockDB.updateRequest(id, { status });
      toast.success(`Marked as ${status.replace('_', ' ')}`);
      load();
      return;
    }
    const { error } = await supabase.from('service_requests').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'IN_PROGRESS' ? { assigned_to: profile?.id } : {}),
    }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    toast.success(`Marked as ${status.replace('_', ' ')}`);
    load();
  }

  const priorityColor: Record<string, string> = {
    LOW: 'neutral', MEDIUM: 'primary', HIGH: 'warning', CRITICAL: 'danger',
  };

  const pending = requests.filter(r => r.status === 'PENDING');
  const inProgress = requests.filter(r => r.status === 'IN_PROGRESS');

  if (loading) return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading service requests…
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1>Duty Dashboard</h1>
          <p>All open service requests — claim and resolve guest issues.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Open', count: requests.length, icon: <ClipboardList size={18} />, color: '#2563eb', bg: '#dbeafe' },
          { label: 'Pending', count: pending.length, icon: <Clock size={18} />, color: '#d97706', bg: '#fef3c7' },
          { label: 'In Progress', count: inProgress.length, icon: <AlertCircle size={18} />, color: '#7c3aed', bg: '#ede9fe' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
            padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <CheckCircle size={52} style={{ margin: '0 auto 1rem', color: '#10b981' }} />
            <h3 style={{ color: '#374151', marginBottom: '8px' }}>All clear!</h3>
            <p>No open service requests. Great work!</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><ClipboardList size={18} /> Service Requests ({requests.length})</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Guest</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const guestName = (r as { profiles?: { full_name?: string } }).profiles?.full_name ?? '—';
                  const roomNo = (r.rooms as { room_number?: string } | undefined)?.room_number ?? '—';
                  const isAssignedToMe = r.assigned_to === profile?.id;
                  const isUnassigned = !r.assigned_to;

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ fontSize: '0.875rem' }}>{r.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                          Room {roomNo} · {r.description.slice(0, 55)}{r.description.length > 55 ? '…' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{guestName}</td>
                      <td><span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{r.category}</span></td>
                      <td><span className={`badge badge-${priorityColor[r.priority] || 'neutral'}`} style={{ fontSize: '0.7rem' }}>{r.priority}</span></td>
                      <td>
                        <span className={`badge badge-${r.status === 'PENDING' ? 'warning' : 'info'}`} style={{ fontSize: '0.7rem' }}>
                          {r.status === 'IN_PROGRESS' ? 'In Progress' : r.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(isUnassigned || r.status === 'PENDING') && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => claimRequest(r.id)}
                            >
                              Claim
                            </button>
                          )}
                          {(isAssignedToMe || r.status === 'IN_PROGRESS') && r.status !== 'COMPLETED' && (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => updateStatus(r.id, 'COMPLETED')}
                            >
                              Done
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
