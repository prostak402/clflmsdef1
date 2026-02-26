export const AUTH_SESSION_STORAGE_KEY = 'auth_session_v1'
const DEFAULT_API_BASE_URL = '/api/v1'
const ACCESS_TTL_MS = 15 * 60 * 1000

function getApiBaseUrl() {
  const raw = import.meta.env?.VITE_API_BASE_URL

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return DEFAULT_API_BASE_URL
  }

  return raw.trim().replace(/\/$/, '')
}

function buildUrl(path) {
  const baseUrl = getApiBaseUrl()
  const url = new URL(`${baseUrl}${path}`, window.location.origin)
  return `${url.pathname}${url.search}`
}

function parseJwtClaims(token) {
  if (typeof token !== 'string' || token.split('.').length < 2) {
    return null
  }

  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function parseJsonSafe(text) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function resolveErrorMessage(payload, fallback) {
  const message = payload?.error?.message || payload?.message
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

async function requestJson(path, { method = 'GET', body, accessToken } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (typeof accessToken === 'string' && accessToken.trim()) {
    headers.Authorization = `Bearer ${accessToken.trim()}`
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = parseJsonSafe(await response.text())

  if (!response.ok) {
    const error = new Error(resolveErrorMessage(payload, `Auth request failed (${response.status})`))
    error.status = response.status
    throw error
  }

  return payload
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function persistSession(session) {
  if (typeof window === 'undefined') {
    return
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

function isSessionExpired(expiresAt) {
  if (!expiresAt) {
    return true
  }

  const ts = Date.parse(expiresAt)
  return Number.isNaN(ts) || ts <= Date.now()
}

function createMockSession(user) {
  const now = new Date()
  return {
    accessToken: `mock_access_${Math.random().toString(36).slice(2, 10)}`,
    refreshToken: `mock_refresh_${Math.random().toString(36).slice(2, 10)}`,
    tokenType: 'Bearer',
    expiresAt: new Date(now.getTime() + ACCESS_TTL_MS).toISOString(),
    user,
  }
}

function createMockUser({ email, displayName }) {
  const normalizedEmail = (email || '').trim().toLowerCase()
  const resolvedRole = normalizedEmail === 'admin@clipflow.com' ? 'admin' : 'user'
  const nameFallback = normalizedEmail.split('@')[0] || 'movie-fan'

  return {
    id: `usr_${normalizedEmail || Math.random().toString(36).slice(2, 10)}`,
    email: normalizedEmail,
    displayName: (displayName || '').trim() || nameFallback,
    avatarUrl: null,
    role: resolvedRole,
    hasCompletedOnboarding: false,
  }
}

function normalizeSessionPayload(payload, fallbackUser = null) {
  const userFromPayload = payload?.user || payload?.me || fallbackUser
  const claims = parseJwtClaims(payload?.accessToken)
  const roleFromClaims = claims?.role || claims?.roles?.[0]

  if (!userFromPayload) {
    return null
  }

  return {
    accessToken: payload?.accessToken || '',
    refreshToken: payload?.refreshToken || '',
    tokenType: payload?.tokenType || 'Bearer',
    expiresAt: payload?.expiresAt || null,
    user: {
      ...userFromPayload,
      role: userFromPayload.role || roleFromClaims || 'user',
    },
  }
}

async function apiSignIn(credentials) {
  const payload = await requestJson('/auth/signin', {
    method: 'POST',
    body: credentials,
  })

  return normalizeSessionPayload(payload)
}

async function apiSignUp(credentials) {
  const payload = await requestJson('/auth/signup', {
    method: 'POST',
    body: credentials,
  })

  return normalizeSessionPayload(payload)
}

async function apiRefresh(refreshToken) {
  const payload = await requestJson('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })

  return normalizeSessionPayload(payload)
}

const isApiDataSource = () => String(import.meta.env?.VITE_DATA_SOURCE || '').trim().toLowerCase() === 'api'

export const authService = {
  isSessionExpired,
  readStoredSession,
  getAccessToken() {
    const session = readStoredSession()
    return session?.accessToken || ''
  },

  async signIn({ email, password }) {
    if (isApiDataSource()) {
      const session = await apiSignIn({ email, password })
      persistSession(session)
      return session
    }

    const session = createMockSession(createMockUser({ email }))
    persistSession(session)
    return session
  },

  async signUp({ displayName, email, password }) {
    if (isApiDataSource()) {
      const session = await apiSignUp({ displayName, email, password })
      persistSession(session)
      return session
    }

    const session = createMockSession(createMockUser({ email, displayName }))
    persistSession(session)
    return session
  },

  async restoreSession() {
    const stored = readStoredSession()
    if (!stored) {
      return { session: null, expired: false }
    }

    if (!isSessionExpired(stored.expiresAt)) {
      return { session: stored, expired: false }
    }

    if (!stored.refreshToken) {
      persistSession(null)
      return { session: null, expired: true }
    }

    try {
      if (isApiDataSource()) {
        const refreshed = await apiRefresh(stored.refreshToken)
        const me = await requestJson('/me', { accessToken: refreshed.accessToken })
        const nextSession = normalizeSessionPayload(refreshed, me)
        persistSession(nextSession)
        return { session: nextSession, expired: false }
      }

      const renewed = {
        ...stored,
        accessToken: `mock_access_${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString(),
      }
      persistSession(renewed)
      return { session: renewed, expired: false }
    } catch {
      persistSession(null)
      return { session: null, expired: true }
    }
  },

  async logout() {
    const session = readStoredSession()

    if (isApiDataSource() && session?.refreshToken) {
      try {
        await requestJson('/auth/logout', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
          accessToken: session.accessToken,
        })
      } catch {
        // ignore logout errors
      }
    }

    persistSession(null)
  },
}
