import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { User } from 'lucide-react';

export default function ProfilePage() {
  const { profile, fetchProfile, user } = useAuth();
  const [form, setForm] = useState({ full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: form.full_name, phone: form.phone, updated_at: new Date().toISOString() }).eq('id', profile.id);
    if (error) toast.error('Update failed');
    else { toast.success('Profile updated!'); await fetchProfile(profile.id); }
    setSaving(false);
  }

  return (
    <div className="page-content" style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="page-header"><h1>My Profile</h1><p>Manage your account details.</p></div>
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>
              {profile?.full_name?.charAt(0).toUpperCase() ?? <User size={28} />}
            </div>
            <div><h3 style={{ marginBottom: '0.25rem' }}>{profile?.full_name}</h3><span className="badge badge-primary">{profile?.role}</span></div>
          </div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email ?? ''} disabled style={{ opacity: 0.6 }} />
            </div>
            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
