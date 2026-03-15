import { AUTH_SESSION_STORAGE_KEY } from '../services/auth-service'

export const APP_STORAGE_KEY = 'app_state_v1'

const DEFAULT_DRAFT_PREFERENCES = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
}

const DEFAULT_APP_STATE = {
  bookmarks: [],
  likes: {},
  blockedCommentUsers: {},
  adminUploads: [],
  adminCatalogMovies: [],
}

function normalizeRole(user = {}) {
  if (typeof user.role === 'string' && user.role.trim()) {
    return user.role.trim()
  }

  return user.isAdmin ? 'admin' : 'user'
}

function normalizeSelectedGenres(value) {
  const normalized = []
  const seen = new Set()

  ;(Array.isArray(value) ? value : []).forEach((entry) => {
    if (typeof entry !== 'string') {
      return
    }

    const normalizedEntry = entry.trim().toLowerCase()
    const genreId = normalizedEntry === 'sci-fi' ? 'scifi' : normalizedEntry
    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
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

function sanitizeBlockedCommentUsers(value) {
  if (Array.isArray(value)) {
    return value.reduce((acc, authorId) => {
      if (typeof authorId === 'string' && authorId.trim()) {
        acc[authorId.trim()] = true
      }
      return acc
    }, {})
  }

  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.entries(value).reduce((acc, [authorId, isBlocked]) => {
    if (typeof authorId === 'string' && authorId.trim() && Boolean(isBlocked)) {
      acc[authorId.trim()] = true
    }
    return acc
  }, {})
}

function sanitizeAppState(state = {}) {
  return {
    bookmarks: Array.isArray(state.bookmarks) ? state.bookmarks : DEFAULT_APP_STATE.bookmarks,
    likes: state.likes && typeof state.likes === 'object' ? state.likes : DEFAULT_APP_STATE.likes,
    blockedCommentUsers: sanitizeBlockedCommentUsers(state.blockedCommentUsers),
    adminUploads: Array.isArray(state.adminUploads)
      ? state.adminUploads
      : DEFAULT_APP_STATE.adminUploads,
    adminCatalogMovies: Array.isArray(state.adminCatalogMovies)
      ? state.adminCatalogMovies
      : DEFAULT_APP_STATE.adminCatalogMovies,
  }
}

function normalizeTestUser(
  user = {},
  { hasCompletedOnboarding = false, selectedGenres = [], draftPreferences = {} } = {}
) {
  const role = normalizeRole(user)
  const email =
    typeof user.email === 'string' && user.email.trim()
      ? user.email.trim()
      : role === 'admin'
        ? 'admin@local.dev'
        : 'user@local.dev'
  const displayName =
    typeof user.displayName === 'string' && user.displayName.trim()
      ? user.displayName.trim()
      : typeof user.name === 'string' && user.name.trim()
        ? user.name.trim()
        : role === 'admin'
          ? 'Admin User'
          : 'Demo User'

  return {
    id:
      typeof user.id === 'string' && user.id.trim()
        ? user.id.trim()
        : role === 'admin'
          ? 'usr_local_admin'
          : 'usr_local_demo',
    email,
    displayName,
    name: displayName,
    role,
    hasCompletedOnboarding: Boolean(hasCompletedOnboarding),
    selectedGenres: normalizeSelectedGenres(user.selectedGenres || selectedGenres),
    preferences: normalizeDraftPreferences(user.preferences || draftPreferences),
  }
}

function persistJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function persistAuthSession({
  user = {},
  hasCompletedOnboarding = false,
  selectedGenres = [],
  draftPreferences = DEFAULT_DRAFT_PREFERENCES,
  accessToken,
  refreshToken,
  expiresAt,
} = {}) {
  const normalizedUser = normalizeTestUser(user, {
    hasCompletedOnboarding,
    selectedGenres,
    draftPreferences,
  })

  persistJson(AUTH_SESSION_STORAGE_KEY, {
    accessToken: accessToken || `test_access_${normalizedUser.role}`,
    refreshToken: refreshToken || `test_refresh_${normalizedUser.role}`,
    tokenType: 'Bearer',
    expiresAt: expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: normalizedUser.id,
      email: normalizedUser.email,
      displayName: normalizedUser.displayName,
      role: normalizedUser.role,
      hasCompletedOnboarding: normalizedUser.hasCompletedOnboarding,
      selectedGenres: normalizedUser.selectedGenres,
      preferences: normalizedUser.preferences,
    },
  })

  return normalizedUser
}

export function persistAppState(state = {}) {
  persistJson(APP_STORAGE_KEY, {
    version: 1,
    state: sanitizeAppState(state),
  })
}

export function persistAuthenticatedState({
  user = {},
  hasCompletedOnboarding = false,
  selectedGenres = [],
  draftPreferences = DEFAULT_DRAFT_PREFERENCES,
  ...state
} = {}) {
  const normalizedUser = normalizeTestUser(user, {
    hasCompletedOnboarding,
    selectedGenres,
    draftPreferences,
  })

  persistAppState(state)
  persistAuthSession({
    user: normalizedUser,
    hasCompletedOnboarding: normalizedUser.hasCompletedOnboarding,
    selectedGenres: normalizedUser.selectedGenres,
    draftPreferences: normalizedUser.preferences,
  })

  return normalizedUser
}

export function persistAnonymousState(state = {}) {
  persistAppState(state)
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}
