import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BedDouble, ConciergeBell, Receipt, LogOut,
  Building, CalendarCheck, Wrench
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const { profile, role, signOut, isAdmin, isStaff, isCustomer } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
      toast.success('Signed out successfully');
    } catch {
      toast.error('Error signing out');
    }
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const roleLabel: Record<string, string> = {
    CUSTOMER: 'Guest',
    STAFF: 'Staff',
    ADMIN: 'Manager',
  };

  return (
    <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Building size={20} color="white" />
        </div>
        <div className="sidebar-logo-text">
          <h2>HotelAI</h2>
          <p>Management System</p>
        </div>
      </div>

      <div className="sidebar-nav">
        {isCustomer && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Guest</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/rooms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <BedDouble size={18} />
              Book a Room
            </NavLink>
            <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ConciergeBell size={18} />
              Service Request
            </NavLink>
            <NavLink to="/bill" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Receipt size={18} />
              Bill & Check-Out
            </NavLink>
          </div>
        )}

        {isStaff && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Operations</div>
            <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Wrench size={18} />
              Duty Dashboard
            </NavLink>
          </div>
        )}

        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Administration</div>
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to="/admin/rooms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <BedDouble size={18} />
              Rooms
            </NavLink>
            <NavLink to="/admin/bookings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <CalendarCheck size={18} />
              Bookings
            </NavLink>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          onClick={handleSignOut}
          className="nav-link"
          style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#fca5a5' }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
        <div className="user-card" style={{ marginTop: '8px' }}>
          <div className="user-avatar">
            {profile?.profile_picture_url
              ? <img src={profile.profile_picture_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : initials
            }
          </div>
          <div className="user-info">
            <div className="user-name">{profile?.full_name || 'Loading...'}</div>
            <div className="user-role">{roleLabel[role] || role}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
