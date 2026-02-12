import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  User, LogOut, Settings, Bookmark, Heart, MessageCircle,
  ChevronRight, Palette, Bell, Shield, HelpCircle
} from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, logout, bookmarks, likes } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const likeCount = Object.values(likes).filter(Boolean).length;

  const menuItems = [
    {
      icon: Bookmark,
      label: 'Saved Movies',
      value: `${bookmarks.length}`,
      onClick: () => navigate('/bookmarks'),
    },
    {
      icon: Heart,
      label: 'Liked Clips',
      value: `${likeCount}`,
    },
    {
      icon: Palette,
      label: 'Genre Preferences',
      onClick: () => navigate('/genres'),
    },
    {
      icon: Bell,
      label: 'Notifications',
      value: 'On',
    },
    {
      icon: Settings,
      label: 'Settings',
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
    },
  ];

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div className="profile-user-info">
            <h2 className="profile-name">{user?.name || 'User'}</h2>
            <p className="profile-email">{user?.email || ''}</p>
            {user?.isAdmin && (
              <span className="profile-admin-badge">
                <Shield size={12} />
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">{bookmarks.length}</span>
            <span className="profile-stat-label">Saved</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-value">{likeCount}</span>
            <span className="profile-stat-label">Liked</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-value">0</span>
            <span className="profile-stat-label">Watched</span>
          </div>
        </div>
      </div>

      <div className="profile-menu">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className="profile-menu-item glass"
            onClick={item.onClick}
            style={{ '--item-delay': `${index * 50}ms` }}
          >
            <div className="profile-menu-icon">
              <item.icon size={20} />
            </div>
            <span className="profile-menu-label">{item.label}</span>
            <div className="profile-menu-right">
              {item.value && <span className="profile-menu-value">{item.value}</span>}
              <ChevronRight size={16} className="profile-menu-arrow" />
            </div>
          </button>
        ))}
      </div>

      <button className="profile-logout" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>

      <p className="profile-version">ClipFlow v1.0.0</p>

    </div>
  );
}
