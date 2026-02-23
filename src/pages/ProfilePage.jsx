import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import { useNavigate } from 'react-router-dom'
import {
  User,
  LogOut,
  Settings,
  Bookmark,
  Heart,
  ChevronRight,
  Palette,
  Bell,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { feedService } from '../services/feed-service'
import DataState from '../components/DataState'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user, logout, getProfile } = useApp()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })

  const loadProfile = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      await feedService.wait(220)
      setProfile(getProfile())
      setLoadState({ status: 'ready', error: '' })
    } catch {
      setLoadState({ status: 'error', error: 'Failed to load profile.' })
    }
  }, [getProfile])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProfile()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProfile])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const hasActivity = profile && (profile.bookmarkCount > 0 || profile.likeCount > 0)

  const menuItems = profile
    ? [
        {
          icon: Bookmark,
          label: 'Saved Movies',
          value: `${profile.bookmarkCount}`,
          onClick: () => navigate('/bookmarks'),
        },
        {
          icon: Heart,
          label: 'Liked Clips',
          value: `${profile.likeCount}`,
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
      ]
    : []

  return (
    <div className="profile-page">
      {loadState.status === 'loading' && (
        <DataState
          variant="loading"
          title="Loading profile"
          description="Fetching your preferences..."
        />
      )}

      {loadState.status === 'error' && (
        <DataState
          variant="error"
          title="Could not load profile"
          description={loadState.error}
          actionLabel="Retry"
          onAction={loadProfile}
        />
      )}

      {loadState.status === 'ready' && profile && (
        <>
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
                <span className="profile-stat-value">{profile.bookmarkCount}</span>
                <span className="profile-stat-label">Saved</span>
              </div>
              <div className="profile-stat-divider" />
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.likeCount}</span>
                <span className="profile-stat-label">Liked</span>
              </div>
              <div className="profile-stat-divider" />
              <div className="profile-stat">
                <span className="profile-stat-value">0</span>
                <span className="profile-stat-label">Watched</span>
              </div>
            </div>
          </div>

          {!hasActivity && (
            <DataState
              title="No activity yet"
              description="Like clips and save bookmarks to build your profile stats."
            />
          )}

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
        </>
      )}
    </div>
  )
}
