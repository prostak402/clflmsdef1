import {
  buildApiUrl,
  createApiError,
  parseJsonResponse,
  requestJson,
  resolveApiErrorMessage,
} from './api-client'

export const AUTH_SESSION_STORAGE_KEY = 'auth_session_v1'
const ACCESS_TTL_MS = 15 * 60 * 1000
const SESSION_ENDED_EVENT = 'auth:session-ended'
const DEFAULT_SESSION_USER_PREFERENCES = Object.freeze({
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
})

let refreshPromise = null

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

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeGenreId(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  return normalized === 'sci-fi' ? 'scifi' : normalized
}

function normalizeGenreIds(...values) {
  const normalized = []
  const seen = new Set()

  values.flat(Infinity).forEach((value) => {
    const genreId = normalizeGenreId(value)

    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
}

function normalizeSessionUserPreferences(value = {}) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return {
    notificationsEnabled:
      typeof safeValue.notificationsEnabled === 'boolean'
        ? safeValue.notificationsEnabled
        : DEFAULT_SESSION_USER_PREFERENCES.notificationsEnabled,
    autoplayEnabled:
      typeof safeValue.autoplayEnabled === 'boolean'
        ? safeValue.autoplayEnabled
        : DEFAULT_SESSION_USER_PREFERENCES.autoplayEnabled,
    preferredLanguage:
      typeof safeValue.preferredLanguage === 'string' && safeValue.preferredLanguage.trim()
        ? safeValue.preferredLanguage.trim()
        : DEFAULT_SESSION_USER_PREFERENCES.preferredLanguage,
  }
}

function normalizeExpiresAt(value) {
  const expiresAt = normalizeNonEmptyString(value)
  if (!expiresAt) {
    return ''
  }

  return Number.isNaN(Date.parse(expiresAt)) ? '' : expiresAt
}

function resolveSessionUserRole(user = {}, fallbackRole = '') {
  const explicitRole = normalizeNonEmptyString(user.role)
  if (explicitRole) {
    return explicitRole
  }

  if (user.isAdmin === true) {
    return 'admin'
  }

  return normalizeNonEmptyString(fallbackRole)
}

function normalizeSessionUser(user = {}, fallbackRole = '') {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return null
  }

  const id = normalizeNonEmptyString(user.id)
  const email = normalizeNonEmptyString(user.email)
  const role = resolveSessionUserRole(user, fallbackRole)

  if (!id || !email || !role) {
    return null
  }

  return {
    ...user,
    id,
    email,
    role,
    selectedGenres: normalizeGenreIds(user.selectedGenres),
    preferences: normalizeSessionUserPreferences(user.preferences),
  }
}

function normalizeSessionShape(session = {}) {
  const accessToken = normalizeNonEmptyString(session.accessToken)
  const refreshToken = normalizeNonEmptyString(session.refreshToken)
  const expiresAt = normalizeExpiresAt(session.expiresAt)
  const user = normalizeSessionUser(session.user, session.user?.role || '')

  if (!accessToken || !refreshToken || !expiresAt || !user) {
    return null
  }

  return {
    ...session,
    accessToken,
    refreshToken,
    tokenType: normalizeNonEmptyString(session.tokenType) || 'Bearer',
    expiresAt,
    user,
  }
}

function normalizeStoredSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    return null
  }

  return normalizeSessionShape(session)
}

function emitSessionEnded(reason = 'logged_out') {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason } }))
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
    const normalized = normalizeStoredSession(parsed)

    if (!normalized) {
      persistSession(null)
      return null
    }

    return normalized
  } catch {
    persistSession(null)
    return null
  }
}

function getStoredSession() {
  return readStoredSession()
}

function normalizeSessionPayload(payload, fallbackUser = null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const accessToken = normalizeNonEmptyString(payload.accessToken)
  const refreshToken = normalizeNonEmptyString(payload.refreshToken)
  const expiresAt = normalizeExpiresAt(payload.expiresAt)
  const claims = parseJwtClaims(accessToken)
  const roleFromClaims = normalizeNonEmptyString(claims?.role || claims?.roles?.[0])
  const userFromPayload = fallbackUser || payload.user || payload.me
  const user = normalizeSessionUser(userFromPayload, roleFromClaims)

  if (!accessToken || !refreshToken || !expiresAt || !user) {
    return null
  }

  return {
    ...payload,
    accessToken,
    refreshToken,
    tokenType: normalizeNonEmptyString(payload.tokenType) || 'Bearer',
    expiresAt,
    user,
  }
}

function assertValidSessionPayload(session, message) {
  if (!session) {
    throw createApiError(message)
  }

  return session
}

function isSessionExpired(expiresAt) {
  if (!expiresAt) {
    return true
  }

  const ts = Date.parse(expiresAt)
  return Number.isNaN(ts) || ts <= Date.now()
}

async function requestJsonWithAccess(path, { method = 'GET', body, accessToken } = {}) {
  return requestJson(path, {
    method,
    body,
    headers:
      typeof accessToken === 'string' && accessToken.trim()
        ? { Authorization: `Bearer ${accessToken.trim()}` }
        : undefined,
  })
}

async function apiSignIn(credentials) {
  const payload = await requestJson('/auth/login', {
    method: 'POST',
    body: credentials,
  })

  return assertValidSessionPayload(normalizeSessionPayload(payload), 'Login payload is invalid')
}

async function apiSignUp(credentials) {
  const payload = await requestJson('/auth/signup', {
    method: 'POST',
    body: credentials,
  })

  return assertValidSessionPayload(normalizeSessionPayload(payload), 'Signup payload is invalid')
}

async function apiRefresh(refreshToken) {
  const payload = await requestJson('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })

  return assertValidSessionPayload(normalizeSessionPayload(payload), 'Refresh payload is invalid')
}

async function apiMe(accessToken) {
  return requestJsonWithAccess('/me', { accessToken })
}

async function refreshSession() {
  if (refreshPromise) {
    return refreshPromise
  }

  const stored = getStoredSession()
  if (!stored?.refreshToken) {
    persistSession(null)
    emitSessionEnded('expired')
    return null
  }

  refreshPromise = (async () => {
    try {
      const refreshed = await apiRefresh(stored.refreshToken)
      const me = await apiMe(refreshed.accessToken)
      const nextSession = assertValidSessionPayload(
        normalizeSessionPayload(refreshed, me),
        'Refresh payload is invalid'
      )

      persistSession(nextSession)
      return nextSession
    } catch {
      persistSession(null)
      emitSessionEnded('expired')
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export const authService = {
  SESSION_ENDED_EVENT,
  isSessionExpired,
  readStoredSession,
  getSession() {
    return getStoredSession()
  },
  updateSessionUser(patch) {
    const session = getStoredSession()
    if (!session?.user) {
      return null
    }

    const nextUser =
      typeof patch === 'function' ? patch(session.user) : { ...session.user, ...(patch || {}) }
    const normalizedUser = normalizeSessionUser(nextUser, session.user.role || '')

    if (!normalizedUser) {
      return null
    }

    const nextSession = {
      ...session,
      user: normalizedUser,
    }

    persistSession(nextSession)
    return nextSession
  },
  async patchCurrentUser(patch = {}) {
    const response = await authService.fetchWithAuth('/me', {
      method: 'PATCH',
      body: patch,
    })
    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      throw createApiError(resolveApiErrorMessage(payload) + ' (' + response.status + ')', {
        status: response.status,
        payload,
      })
    }

    const currentSession = getStoredSession()
    if (!currentSession?.user) {
      throw createApiError('Session is missing after PATCH /me')
    }

    const normalizedUser = normalizeSessionUser(
      {
        ...currentSession.user,
        ...(payload || {}),
      },
      currentSession.user.role || ''
    )

    if (!normalizedUser) {
      throw createApiError('PATCH /me returned invalid user payload')
    }

    const nextSession = {
      ...currentSession,
      user: normalizedUser,
    }

    persistSession(nextSession)
    return nextSession
  },
  subscribeToSessionEnded(listener) {
    if (typeof window === 'undefined' || typeof listener !== 'function') {
      return () => {}
    }

    const handler = (event) => {
      listener(event?.detail?.reason || 'expired')
    }

    window.addEventListener(SESSION_ENDED_EVENT, handler)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handler)
  },
  getAccessToken() {
    const session = getStoredSession()
    return session?.accessToken || ''
  },
  async signIn({ email, password }) {
    const session = await apiSignIn({ email, password })
    persistSession(session)
    return session
  },
  async signUp({ displayName, email, password }) {
    const session = await apiSignUp({ displayName, email, password })
    persistSession(session)
    return session
  },
  async restoreSession() {
    const stored = getStoredSession()
    if (!stored) {
      return { session: null, expired: false }
    }

    if (!isSessionExpired(stored.expiresAt)) {
      return { session: stored, expired: false }
    }

    const refreshed = await refreshSession()
    if (!refreshed) {
      return { session: null, expired: true }
    }

    return { session: refreshed, expired: false }
  },
  async fetchWithAuth(path, options = {}) {
    const { method = 'GET', query, headers, body } = options
    const execute = async (accessToken) => {
      try {
        return await fetch(buildApiUrl(path, query), {
          method,
          headers: {
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(headers || {}),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch (error) {
        throw createApiError(`Network request failed for ${method} ${path}`, { cause: error })
      }
    }

    let session = getStoredSession()
    if (session?.expiresAt && isSessionExpired(session.expiresAt)) {
      session = await refreshSession()
    }

    let response = await execute(session?.accessToken || '')

    if (response.status === 401 && session?.refreshToken) {
      const refreshed = await refreshSession()
      if (!refreshed?.accessToken) {
        return response
      }

      response = await execute(refreshed.accessToken)
    }

    return response
  },
  async logout() {
    const session = getStoredSession()

    if (session?.refreshToken) {
      try {
        await requestJson('/auth/logout', {
          method: 'POST',
          body: { refreshToken: session.refreshToken },
          headers:
            typeof session.accessToken === 'string' && session.accessToken.trim()
              ? { Authorization: `Bearer ${session.accessToken.trim()}` }
              : undefined,
        })
      } catch {
        // ignore logout errors
      }
    }

    persistSession(null)
    emitSessionEnded('logged_out')
  },
}
