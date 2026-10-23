import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, profile, isCustomer, isAdmin, isStaff, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;

    void (async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        const notifs = (data ?? []) as Notification[];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.is_read).length);
      } catch { /* ignore */ }
    })();

    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev.slice(0, 9)]);
        setUnreadCount((c) => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = useCallback(async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  const notificationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      INFO: '#2563eb', SUCCESS: '#16a34a', WARNING: '#d97706', ERROR: '#dc2626',
    };
    return colors[type] || colors.INFO;
  };

  const titles: Record<string, { title: string; desc: string }> = {
    '/dashboard':     { title: 'Guest Dashboard',    desc: 'Your stay at a glance' },
    '/rooms':         { title: 'Room Catalog',        desc: 'Browse and book available rooms' },
    '/requests/new':  { title: 'New Service Request', desc: 'Submit a request to our team' },
    '/bill':          { title: 'Bill & Check-Out',    desc: 'Itemized charges and departure' },
    '/staff':         { title: 'Duty Dashboard',      desc: 'Service requests and assignments' },
    '/admin':         { title: 'Hotel Dashboard',     desc: 'Revenue, occupancy and operations' },
    '/admin/rooms':   { title: 'Room Management',     desc: 'Add, edit and manage hotel rooms' },
    '/admin/bookings':{ title: 'Bookings',            desc: 'Check-in, check-out and guest stays' },
    '/admin/staff':   { title: 'Staff Management',   desc: 'Manage staff and assignments' },
  };
  const pageInfo = titles[location.pathname] || { title: 'HotelAI', desc: '' };

  const roleBadge = isAdmin
    ? { label: 'Admin', color: '#7c3aed', bg: '#ede9fe' }
    : isStaff
    ? { label: 'Staff', color: '#059669', bg: '#d1fae5' }
    : { label: 'Guest', color: '#2563eb', bg: '#dbeafe' };
  void role;

  return (
    <header className="navbar">
      <button
        className="btn btn-ghost btn-icon"
        onClick={onMenuClick}
        aria-label="Toggle menu"
        style={{ display: 'none' }}
        id="menu-toggle"
      >
        <Menu size={20} />
      </button>
      <style>{`@media (max-width: 1024px) { #menu-toggle { display: flex !important; } }`}</style>

      <div className="navbar-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>{pageInfo.title}</h1>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px',
            borderRadius: '20px', color: roleBadge.color, background: roleBadge.bg,
            letterSpacing: '0.03em',
          }}>
            {roleBadge.label}
          </span>
        </div>
        {pageInfo.desc && <p>{pageInfo.desc}</p>}
      </div>

      <div className="navbar-actions">
        {isCustomer && (
          <button className="btn btn-primary" onClick={() => navigate('/requests/new')}>
            New Request
          </button>
        )}

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon notification-badge"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge-dot" />}
          </button>

          {showNotifications && (
            <div className="notification-dropdown-panel" style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '8px',
              width: '360px', background: 'white', borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
              zIndex: 500, overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px', borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Notifications</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} style={{
                      fontSize: '0.75rem', color: '#2563eb', background: 'none',
                      border: 'none', cursor: 'pointer', fontWeight: 500,
                    }}>Mark all read</button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                    <Bell size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.875rem' }}>No notifications yet</p>
                  </div>
                ) : notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { handleMarkRead(n.id); if (n.action_url) navigate(n.action_url); setShowNotifications(false); }}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start',
                      background: n.is_read ? 'white' : '#eff6ff',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: n.is_read ? '#d1d5db' : notificationTypeColor(n.type),
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#111827' }}>{n.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{n.message}</div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link to={isCustomer ? '/dashboard' : isStaff ? '/staff' : '/admin'} style={{ textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36,
            background: isAdmin ? '#7c3aed' : isStaff ? '#059669' : '#2563eb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', color: 'white', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', border: '2px solid rgba(255,255,255,0.3)',
          }}>
            {profile?.profile_picture_url
              ? <img src={profile.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : profile?.full_name?.charAt(0).toUpperCase() || '?'
            }
          </div>
        </Link>
      </div>
    </header>
  );
}
