import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { notificationsService } from '@/services/notifications.service';
import type { Notification } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, profile, isCustomer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    notificationsService.getNotifications(user.id, 10).then(setNotifications).catch(() => undefined);
    notificationsService.getUnreadCount(user.id).then(setUnreadCount).catch(() => undefined);
    const unsubscribe = notificationsService.subscribeToNotifications(user.id, (notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 9)]);
      setUnreadCount((c) => c + 1);
    });
    return unsubscribe;
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

  const handleMarkRead = async (id: string) => {
    await notificationsService.markAsRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await notificationsService.markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const titles: Record<string, { title: string; desc: string }> = {
    '/dashboard': { title: 'Guest Dashboard', desc: 'Your stay at a glance' },
    '/rooms': { title: 'Room Catalog', desc: 'Browse and book rooms' },
    '/requests/new': { title: 'New Service Request', desc: 'AI-assisted guest services' },
    '/bill': { title: 'Bill & Check-Out', desc: 'Itemized charges and departure' },
    '/staff': { title: 'Duty Dashboard', desc: 'Assigned requests and housekeeping' },
    '/admin': { title: 'Hotel Dashboard', desc: 'Revenue, occupancy, and operations' },
    '/admin/rooms': { title: 'Room Management', desc: 'Create and edit hotel rooms' },
    '/admin/bookings': { title: 'Bookings', desc: 'Check-in, check-out, and guest stays' },
  };
  const pageInfo = titles[location.pathname] || { title: 'HotelAI', desc: '' };

  const notificationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      INFO: '#2563eb', SUCCESS: '#16a34a', WARNING: '#d97706', ERROR: '#dc2626'
    };
    return colors[type] || colors.INFO;
  };

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
        <h1>{pageInfo.title}</h1>
        {pageInfo.desc && <p>{pageInfo.desc}</p>}
      </div>

      <div className="navbar-actions">
        {isCustomer && (
          <button
            className="btn btn-primary"
            onClick={() => navigate('/requests/new')}
          >
            New request
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
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '8px',
              width: '360px', background: 'white', borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
              zIndex: 500, overflow: 'hidden'
            }}>
              <div style={{
                padding: '16px', borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Notifications</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} style={{
                      fontSize: '0.75rem', color: '#2563eb', background: 'none',
                      border: 'none', cursor: 'pointer', fontWeight: 500
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
                      background: n.is_read ? '#d1d5db' : notificationTypeColor(n.type)
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

        <Link to={isCustomer ? '/dashboard' : '#'} style={{ textDecoration: 'none' }}>
          <div className="user-avatar" style={{
            width: 36, height: 36, background: '#1e40af', display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
            color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            border: '2px solid #bfdbfe'
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
