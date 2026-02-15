import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { Home, Search, Bookmark, User, Shield, Film } from 'lucide-react';
import './SideNav.css';

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Feed' },
  { path: '/catalog', icon: Search, label: 'Catalog' },
  { path: '/bookmarks', icon: Bookmark, label: 'Saved' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function SideNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useApp();

  const items = user?.isAdmin
    ? [...NAV_ITEMS, { path: '/admin', icon: Shield, label: 'Admin' }]
    : NAV_ITEMS;

  return (
    <nav className="sidenav">
      <div className="sidenav-logo" onClick={() => navigate('/feed')}>
        <div className="sidenav-logo-icon">
          <Film size={22} />
        </div>
        <span className="sidenav-logo-text">ClipFlow</span>
      </div>

      <div className="sidenav-items">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const NavIcon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              className={`sidenav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              <div className="sidenav-item-icon">
                <NavIcon size={20} />
              </div>
              <span className="sidenav-item-label">{item.label}</span>
              {isActive && <div className="sidenav-active-bar" />}
            </button>
          );
        })}
      </div>

      <div className="sidenav-user" onClick={() => navigate('/profile')}>
        <div className="sidenav-user-avatar">
          <User size={16} />
        </div>
        <div className="sidenav-user-info">
          <span className="sidenav-user-name">{user?.name || 'User'}</span>
          <span className="sidenav-user-email">{user?.email || ''}</span>
        </div>
      </div>
    </nav>
  );
}
