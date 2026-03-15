import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/useApp'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Bookmark, Heart, ChevronRight, Shield, HelpCircle } from 'lucide-react'
import { feedService } from '../services/feed-service'
import './ProfilePage.css'
import DataState from '../components/DataState'

const DEFAULT_DRAFT_PREFERENCES = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
}

function normalizeDraftPreferences(value = {}) {
  const safeValue = value && typeof value === 'object' ? value : {}

  return {
    notificationsEnabled:
      typeof safeValue.notificationsEnabled === 'boolean'
        ? safeValue.notificationsEnabled
        : DEFAULT_DRAFT_PREFERENCES.notificationsEnabled,
    autoplayEnabled:
      typeof safeValue.autoplayEnabled === 'boolean'
        ? safeValue.autoplayEnabled
        : DEFAULT_DRAFT_PREFERENCES.autoplayEnabled,
    preferredLanguage:
      typeof safeValue.preferredLanguage === 'string' && safeValue.preferredLanguage.trim()
        ? safeValue.preferredLanguage.trim()
        : DEFAULT_DRAFT_PREFERENCES.preferredLanguage,
  }
}

function areSameGenreLists(left, right) {
  const leftGenres = Array.isArray(left) ? left : []
  const rightGenres = Array.isArray(right) ? right : []

  if (leftGenres.length !== rightGenres.length) {
    return false
  }

  return leftGenres.every((genreId, index) => genreId === rightGenres[index])
}

function areSameDraftPreferences(left, right) {
  const leftPreferences = normalizeDraftPreferences(left)
  const rightPreferences = normalizeDraftPreferences(right)

  return (
    leftPreferences.notificationsEnabled === rightPreferences.notificationsEnabled &&
    leftPreferences.autoplayEnabled === rightPreferences.autoplayEnabled &&
    leftPreferences.preferredLanguage === rightPreferences.preferredLanguage
  )
}

export default function ProfilePage() {
  const {
    user,
    genres = [],
    logout,
    getProfile,
    saveProfilePreferences,
    isProfileSyncing,
    profileSyncError,
  } = useApp()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [genreDraft, setGenreDraft] = useState([])
  const [preferencesDraft, setPreferencesDraft] = useState(DEFAULT_DRAFT_PREFERENCES)
  const [saveState, setSaveState] = useState({ status: 'idle', error: '' })

  const hydrateDrafts = useCallback((nextProfile) => {
    setGenreDraft(Array.isArray(nextProfile?.selectedGenres) ? nextProfile.selectedGenres : [])
    setPreferencesDraft(normalizeDraftPreferences(nextProfile?.draftPreferences))
  }, [])

  const loadProfile = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      await feedService.wait(220)
      const nextProfile = await getProfile()
      setProfile(nextProfile)
      hydrateDrafts(nextProfile)
      setLoadState({ status: 'ready', error: '' })
      return nextProfile
    } catch {
      setLoadState({ status: 'error', error: 'Failed to load profile.' })
      return null
    }
  }, [getProfile, hydrateDrafts])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProfile()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProfile])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const hasActivity = profile && (profile.bookmarkCount > 0 || profile.likeCount > 0)

  const menuItems = profile
    ? [
        {
          icon: Bookmark,
          label: 'Saved Movies',
          value: String(profile.bookmarkCount),
          onClick: () => navigate('/bookmarks'),
        },
        {
          icon: Heart,
          label: 'Liked Clips',
          value: String(profile.likeCount),
        },
        {
          icon: HelpCircle,
          label: 'Help & Support',
        },
      ]
    : []

  const isDirty = useMemo(() => {
    if (!profile) {
      return false
    }

    return (
      !areSameGenreLists(genreDraft, profile.selectedGenres) ||
      !areSameDraftPreferences(preferencesDraft, profile.draftPreferences)
    )
  }, [genreDraft, preferencesDraft, profile])

  const toggleDraftGenre = (genreId) => {
    setSaveState({ status: 'idle', error: '' })
    setGenreDraft((current) =>
      current.includes(genreId)
        ? current.filter((currentGenreId) => currentGenreId !== genreId)
        : [...current, genreId]
    )
  }

  const handlePreferenceChange = (key, value) => {
    setSaveState({ status: 'idle', error: '' })
    setPreferencesDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const resetDrafts = () => {
    hydrateDrafts(profile)
    setSaveState({ status: 'idle', error: '' })
  }

  const handleSave = async () => {
    if (!profile || !isDirty || isProfileSyncing) {
      return
    }

    setSaveState({ status: 'saving', error: '' })

    try {
      await saveProfilePreferences({
        selectedGenres: genreDraft,
        draftPreferences: preferencesDraft,
      })
      const nextProfile = await getProfile()
      setProfile(nextProfile)
      hydrateDrafts(nextProfile)
      setSaveState({ status: 'saved', error: '' })
    } catch (error) {
      hydrateDrafts(profile)
      setSaveState({
        status: 'error',
        error:
          error instanceof Error ? error.message : profileSyncError || 'Failed to save profile.',
      })
    }
  }

  const saveError = saveState.error || profileSyncError

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
                <h2 className="profile-name">{profile.name || user?.name || 'User'}</h2>
                <p className="profile-email">{profile.email || user?.email || ''}</p>
                {user?.role === 'admin' && (
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
                <span className="profile-stat-value">{profile.watchedCount ?? 0}</span>
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

          <section className="profile-preferences-card glass">
            <div className="profile-section-head">
              <div>
                <h3 className="profile-section-title">Favorite genres</h3>
                <p className="profile-section-copy">
                  Saved to your profile and used as the default feed filter.
                </p>
              </div>
              <button
                type="button"
                className="profile-link-action"
                onClick={() => setGenreDraft([])}
                disabled={genreDraft.length === 0 || isProfileSyncing}
              >
                Clear all
              </button>
            </div>

            <div className="profile-genre-grid">
              {genres.map((genre) => {
                const isSelected = genreDraft.includes(genre.id)
                return (
                  <button
                    key={genre.id}
                    type="button"
                    className={'profile-genre-chip' + (isSelected ? ' active' : '')}
                    onClick={() => toggleDraftGenre(genre.id)}
                    disabled={isProfileSyncing}
                  >
                    {genre.name}
                  </button>
                )
              })}
            </div>

            <div className="profile-section-head profile-section-head-compact">
              <div>
                <h3 className="profile-section-title">Playback & notifications</h3>
                <p className="profile-section-copy">
                  These settings are backend-backed and restored after login.
                </p>
              </div>
            </div>

            <div className="profile-preference-list">
              <label className="profile-toggle-row">
                <span>
                  <strong>Notifications</strong>
                  <small>Receive update alerts for saved clips.</small>
                </span>
                <input
                  type="checkbox"
                  aria-label="Notifications"
                  checked={preferencesDraft.notificationsEnabled}
                  onChange={(event) =>
                    handlePreferenceChange('notificationsEnabled', event.target.checked)
                  }
                  disabled={isProfileSyncing}
                />
              </label>

              <label className="profile-toggle-row">
                <span>
                  <strong>Autoplay</strong>
                  <small>Start the next clip automatically in the feed.</small>
                </span>
                <input
                  type="checkbox"
                  aria-label="Autoplay"
                  checked={preferencesDraft.autoplayEnabled}
                  onChange={(event) =>
                    handlePreferenceChange('autoplayEnabled', event.target.checked)
                  }
                  disabled={isProfileSyncing}
                />
              </label>

              <label className="profile-language-field">
                <span className="profile-language-label">Preferred language</span>
                <input
                  type="text"
                  aria-label="Preferred language"
                  value={preferencesDraft.preferredLanguage}
                  onChange={(event) =>
                    handlePreferenceChange('preferredLanguage', event.target.value)
                  }
                  placeholder="en"
                  disabled={isProfileSyncing}
                />
              </label>
            </div>

            <div className="profile-save-row">
              <div className="profile-save-copy">
                {saveState.status === 'saved' && <span>Preferences saved.</span>}
                {saveError && <span className="profile-save-error">{saveError}</span>}
              </div>
              <div className="profile-save-actions">
                <button
                  type="button"
                  className="profile-secondary-action"
                  onClick={resetDrafts}
                  disabled={!isDirty || isProfileSyncing}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="profile-primary-action"
                  onClick={handleSave}
                  disabled={!isDirty || isProfileSyncing}
                >
                  {isProfileSyncing || saveState.status === 'saving'
                    ? 'Saving...'
                    : 'Save preferences'}
                </button>
              </div>
            </div>
          </section>

          <div className="profile-menu">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="profile-menu-item glass"
                onClick={item.onClick}
                style={{ '--item-delay': String(index * 50) + 'ms' }}
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
