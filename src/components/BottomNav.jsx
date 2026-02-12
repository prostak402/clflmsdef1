import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Home, Search, Bookmark, User, Shield } from 'lucide-react';
import './BottomNav.css';

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Feed' },
  { path: '/catalog', icon: Search, label: 'Catalog' },
  { path: '/bookmarks', icon: Bookmark, label: 'Saved' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useApp();

  const items = user?.isAdmin
    ? [...NAV_ITEMS, { path: '/admin', icon: Shield, label: 'Admin' }]
    : NAV_ITEMS;

  return (
    <nav className="bottom-nav glass-strong">
      {items.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <div className="nav-icon-wrap">
              <Icon size={22} />
              {isActive && <div className="nav-indicator" />}
            </div>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
