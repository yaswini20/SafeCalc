import React from 'react';
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Route,
  Shield,
  Users,
  X,
  UserRound,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/journey', label: 'Journey', icon: Route },
  { to: '/geofences', label: 'Safety Map', icon: MapPin },
  { to: '/contacts', label: 'Emergency Contacts', icon: Users },
  { to: '/history', label: 'Travel History', icon: History },
  { to: '/profile', label: 'My Profile', icon: UserRound },
];

export default function Layout({ children, title = 'Dashboard' }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <div className="web-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Shield size={21} />
          </div>

          <div>
            <strong>Safe Calc</strong>
            <span>PERSONAL SAFETY COMPANION</span>
          </div>

          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="side-user"
          onClick={() => navigate('/profile')}
        >
          <div className="avatar">
            <UserRound size={18} />
          </div>

          <div>
            <strong>{user?.name || 'Traveler'}</strong>
            <span>{user?.email || ''}</span>
          </div>
        </div>

        <div className="side-label">MAIN MENU</div>

        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Resolve SOS removed from sidebar.
            Resolve is shown only on Dashboard when an
            actual active SOS exists. */}

        <button
          className="logout-side"
          onClick={logout}
        >
          <LogOut size={16} />
          Log Out
        </button>
      </aside>

      {open && (
        <div
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="mobile-title">
            <Shield size={17} />
            <span>{title}</span>
          </div>

          <div className="top-actions">
            <span
              className={`connection ${
                connected ? 'online' : ''
              }`}
            >
              <i />
              {connected ? 'Connected' : 'Offline'}
            </span>

            <button className="icon-top">
              <Bell size={17} />
            </button>

            <button
              className="user-top"
              onClick={() => navigate('/profile')}
            >
              <UserRound size={15} />
              {user?.name || 'User'}
            </button>
          </div>
        </header>

        <main className="page-wrap">
          {children}
        </main>
      </div>
    </div>
  );
}