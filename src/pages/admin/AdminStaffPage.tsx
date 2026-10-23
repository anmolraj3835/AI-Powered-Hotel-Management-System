import { useEffect, useState } from 'react';
import { supabase, isSupabaseOffline } from '@/lib/supabase';
import { MockDB } from '@/lib/mockData';
import toast from 'react-hot-toast';
import { Plus, Trash2, UserCheck, UserX, ClipboardList, WifiOff } from 'lucide-react';
import type { Profile, ServiceRequest } from '@/types/database';

type Tab = 'staff' | 'requests';

export default function AdminStaffPage() {
  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [staff, setStaff] = useState<Profile[]>([]);
  const [pending, setPending] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});

  // Add Staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: '', email: '', phone: '' });
  const [addLoading, setAddLoading] = useState(false);

  // Remove confirm state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const offline = isSupabaseOffline;

  async function load() {
    setLoading(true);
    if (offline) {
      setStaff(MockDB.getStaff());
      setPending(MockDB.getPendingUnassigned());
      setLoading(false);
      return;
    }
    const [sRes, rRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'STAFF').order('full_name'),
      supabase.from('service_requests').select('*').eq('status', 'PENDING').is('assigned_to', null),
    ]);
    setStaff((sRes.data ?? []) as Profile[]);
    setPending((rRes.data ?? []) as ServiceRequest[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Assign request ────────────────────────────────────────────────────────
  async function assign(requestId: string) {
    const staffId = selectedStaff[requestId];
    if (!staffId) { toast.error('Select a staff member first'); return; }
    setAssigning(requestId);

    if (offline) {
      MockDB.assignRequest(requestId, staffId);
      toast.success('Assigned successfully! (Demo mode)');
      setPending(prev => prev.filter(r => r.id !== requestId));
      setAssigning(null);
      return;
    }

    const { error } = await supabase
      .from('service_requests')
      .update({ assigned_to: staffId, status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) toast.error('Assignment failed');
    else {
      toast.success('Assigned successfully!');
      setPending(prev => prev.filter(r => r.id !== requestId));
    }
    setAssigning(null);
  }

  // ── Add Staff ─────────────────────────────────────────────────────────────
  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.full_name.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setAddLoading(true);

    // ── Demo / Offline mode ────────────────────────────────────────────────
    if (offline) {
      MockDB.addStaff({
        email: addForm.email.trim().toLowerCase(),
        full_name: addForm.full_name.trim(),
        phone: addForm.phone.trim() || null,
        role: 'STAFF',
        is_active: true,
      });
      toast.success(`${addForm.full_name} added to staff (Demo mode)`);
      setShowAddModal(false);
      setAddForm({ full_name: '', email: '', phone: '' });
      setStaff(MockDB.getStaff());
      setAddLoading(false);
      return;
    }

    try {
      // Create auth user with a temporary password — staff must reset via email
      const tempPassword = `Staff@${Math.random().toString(36).slice(2, 10)}`;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: addForm.email.trim(),
        password: tempPassword,
        options: {
          data: {
            full_name: addForm.full_name.trim(),
            phone: addForm.phone.trim() || null,
            role: 'STAFF',
          },
        },
      });

      if (signUpError) {
        // If user already exists, try to update their profile role to STAFF
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', addForm.email.trim().toLowerCase())
            .maybeSingle();

          if (existing) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'STAFF', is_active: true, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            if (updateError) throw updateError;
            toast.success(`${addForm.full_name} promoted to Staff!`);
            setShowAddModal(false);
            setAddForm({ full_name: '', email: '', phone: '' });
            load();
            return;
          }
        }
        throw signUpError;
      }

      if (signUpData?.user) {
        await supabase.from('profiles').upsert({
          id: signUpData.user.id,
          email: addForm.email.trim().toLowerCase(),
          full_name: addForm.full_name.trim(),
          phone: addForm.phone.trim() || null,
          role: 'STAFF',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }

      toast.success(`Staff member added! A confirmation email has been sent to ${addForm.email}.`);
      setShowAddModal(false);
      setAddForm({ full_name: '', email: '', phone: '' });
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add staff';
      if (msg.includes('fetch') || msg.includes('Failed')) {
        // Fallback to mock on network error
        MockDB.addStaff({ email: addForm.email.trim().toLowerCase(), full_name: addForm.full_name.trim(), phone: addForm.phone.trim() || null, role: 'STAFF', is_active: true });
        toast.success(`${addForm.full_name} added (Demo mode — backend offline)`);
        setShowAddModal(false);
        setAddForm({ full_name: '', email: '', phone: '' });
        setStaff(MockDB.getStaff());
      } else {
        toast.error(msg);
      }
    } finally {
      setAddLoading(false);
    }
  }

  // ── Remove (deactivate) Staff ─────────────────────────────────────────────
  async function handleRemoveStaff(id: string, name: string) {
    if (!confirm(`Remove "${name}" from staff? They will lose staff access.`)) return;
    setRemovingId(id);

    if (offline) {
      MockDB.removeStaff(id);
      toast.success(`${name} has been removed from staff (Demo mode).`);
      setStaff(MockDB.getStaff());
      setRemovingId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'CUSTOMER', is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(`${name} has been removed from staff.`);
      setStaff(prev => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove staff';
      if (msg.includes('fetch') || msg.includes('Failed')) {
        MockDB.removeStaff(id);
        toast.success(`${name} removed (Demo mode — backend offline)`);
        setStaff(MockDB.getStaff());
      } else {
        toast.error(msg);
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
      Loading staff data…
    </div>
  );

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>Staff Management</h1>
          <p>Add, remove staff members and assign service requests.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          <UserCheck size={16} /> Staff Members ({staff.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <ClipboardList size={16} /> Unassigned Requests ({pending.length})
        </button>
      </div>

      {/* ── Staff List Tab ── */}
      {activeTab === 'staff' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <UserCheck size={18} /> Active Staff ({staff.length})
            </span>
          </div>
          {staff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><UserX size={32} /></div>
              <h3>No staff members yet</h3>
              <p>Click "Add Staff" to invite your first team member.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="hide-mobile">Email</th>
                    <th className="hide-mobile">Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: '#2563eb', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                          }}>
                            {s.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.full_name}</div>
                            <div className="hide-mobile" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-mobile" style={{ fontSize: '0.85rem', color: '#6b7280' }}>{s.email}</td>
                      <td className="hide-mobile" style={{ fontSize: '0.85rem', color: '#6b7280' }}>{s.phone || '—'}</td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveStaff(s.id, s.full_name)}
                          disabled={removingId === s.id}
                          title={`Remove ${s.full_name} from staff`}
                        >
                          <Trash2 size={13} />
                          <span className="portal-tab-label"> Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Unassigned Requests Tab ── */}
      {activeTab === 'requests' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <ClipboardList size={18} /> Unassigned Requests ({pending.length})
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pending.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                ✅ All requests have been assigned!
              </div>
            ) : pending.map(r => (
              <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.875rem' }}>
                <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{r.title}</strong>
                  <span className="badge badge-primary">{r.category.replace('_', ' ')}</span>
                  <span className={`badge badge-${r.priority === 'HIGH' || r.priority === 'CRITICAL' ? 'danger' : r.priority === 'MEDIUM' ? 'warning' : 'success'}`}>
                    {r.priority}
                  </span>
                </div>
                {r.description && (
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem', margin: '0 0 0.75rem' }}>
                    {r.description.slice(0, 120)}{r.description.length > 120 ? '…' : ''}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    style={{ flex: 1, minWidth: '160px' }}
                    value={selectedStaff[r.id] ?? ''}
                    onChange={e => setSelectedStaff(prev => ({ ...prev, [r.id]: e.target.value }))}
                  >
                    <option value="">Select staff member…</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => assign(r.id)}
                    disabled={assigning === r.id || !selectedStaff[r.id]}
                  >
                    {assigning === r.id ? 'Assigning…' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Staff Member</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddStaff}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
                  A confirmation email will be sent to the staff member. They can set their own password via the link in that email.
                </div>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={addForm.full_name}
                    onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="rahul@hotel.com"
                    value={addForm.email}
                    onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 9876543210"
                    value={addForm.phone}
                    onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                  {addLoading ? 'Adding…' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
