import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { Home, Search, Bookmark, User, Shield } from 'lucide-react'
import './BottomNav.css'

const renderNavIcon = (Icon, size) => <Icon size={size} />

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Feed' },
  { path: '/catalog', icon: Search, label: 'Catalog' },
  { path: '/bookmarks', icon: Bookmark, label: 'Saved' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useApp()
  const isAdmin = user?.role === 'admin'

  const items = isAdmin
    ? [...NAV_ITEMS, { path: '/admin', icon: Shield, label: 'Admin' }]
    : NAV_ITEMS

  return (
    <nav className="bottom-nav glass-strong">
      {items.map((item) => {
        const isActive = location.pathname === item.path
        const NavIcon = item.icon

        return (
          <button
            key={item.path}
            type="button"
            className={`nav-item ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => navigate(item.path)}
          >
            <div className="nav-icon-wrap">
              {renderNavIcon(NavIcon, 22)}
              {isActive && <div className="nav-indicator" />}
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
