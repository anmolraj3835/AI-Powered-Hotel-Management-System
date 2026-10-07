import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Bell } from 'lucide-react';
import type { Notification } from '@/types/database';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setNotifications((data ?? []) as Notification[]); setLoading(false); });
  }, [profile]);

  async function markAllRead() {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const typeColor: Record<string, string> = { INFO: 'primary', SUCCESS: 'success', WARNING: 'warning', ERROR: 'danger' };

  if (loading) return <div className="page-content"><p>Loading notifications…</p></div>;

  return (
    <div className="page-content" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Notifications</h1><p>Your recent alerts and updates.</p></div>
        {notifications.some(n => !n.is_read) && <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark all read</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notifications.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <Bell size={48} style={{ margin: '0 auto 1rem' }} />
            <p>No notifications yet.</p>
          </div>
        )}
        {notifications.map(n => (
          <div key={n.id} className="card" style={{ border: n.is_read ? '1px solid #e5e7eb' : '1px solid #bfdbfe', background: n.is_read ? undefined : '#eff6ff' }}>
            <div className="card-body" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span className={`badge badge-${typeColor[n.type] ?? 'neutral'}`} style={{ marginTop: '2px', flexShrink: 0 }}>{n.type}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{n.title}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{n.message}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '6px' }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
