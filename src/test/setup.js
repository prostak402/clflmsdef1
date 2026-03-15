import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
})

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
})

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: () => {},
})

if (!window.HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const AUTH_SESSION_STORAGE_KEY = 'auth_session_v1'
const DEFAULT_DRAFT_PREFERENCES = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
}
const realFetch = globalThis.fetch.bind(globalThis)

globalThis.__REAL_FETCH__ = realFetch

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
}

function emptyResponse(status = 204) {
  return new Response(null, { status })
}

function parseBody(body) {
  if (!body) {
    return {}
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }

  return body
}

function parseRequestUrl(input) {
  const rawUrl = typeof input === 'string' ? input : input?.url || ''
  return new URL(rawUrl, 'http://localhost')
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

function normalizePreferences(value = {}) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

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

function normalizeSessionUserShape(user = {}) {
  const role = user.role || (user.isAdmin ? 'admin' : 'user')
  const email =
    typeof user.email === 'string' && user.email.trim()
      ? user.email.trim()
      : role === 'admin'
        ? 'admin@local.dev'
        : 'user@local.dev'

  return {
    id:
      typeof user.id === 'string' && user.id.trim()
        ? user.id.trim()
        : role === 'admin'
          ? 'usr_local_admin'
          : 'usr_local_demo',
    email,
    displayName:
      typeof user.displayName === 'string' && user.displayName.trim()
        ? user.displayName.trim()
        : typeof user.name === 'string' && user.name.trim()
          ? user.name.trim()
          : role === 'admin'
            ? 'Admin User'
            : 'Demo User',
    role,
    hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
    selectedGenres: normalizeSelectedGenres(user.selectedGenres),
    preferences: normalizePreferences(user.preferences),
  }
}

function readStoredSessionUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (!parsed?.user || typeof parsed.user !== 'object') {
      return null
    }

    const role = parsed.user.role || (parsed.user.isAdmin ? 'admin' : 'user')
    return normalizeSessionUserShape({
      id:
        typeof parsed.user.id === 'string' && parsed.user.id.trim()
          ? parsed.user.id.trim()
          : role === 'admin'
            ? 'usr_local_admin'
            : 'usr_local_demo',
      email:
        typeof parsed.user.email === 'string' && parsed.user.email.trim()
          ? parsed.user.email.trim()
          : role === 'admin'
            ? 'admin@local.dev'
            : 'user@local.dev',
      displayName:
        parsed.user.displayName ||
        parsed.user.name ||
        (role === 'admin' ? 'Admin User' : 'Demo User'),
      role,
      hasCompletedOnboarding: Boolean(parsed.user.hasCompletedOnboarding),
      selectedGenres: normalizeSelectedGenres(parsed.user.selectedGenres),
      preferences: normalizePreferences(parsed.user.preferences),
    })
  } catch {
    return null
  }
}

function createApiTestFetch() {
  const state = {
    sessionUser: normalizeSessionUserShape({
      id: 'usr_local_demo',
      email: 'user@local.dev',
      displayName: 'Demo User',
      role: 'user',
      hasCompletedOnboarding: false,
      selectedGenres: [],
      preferences: normalizePreferences(),
    }),
    usersByEmail: {
      'user@local.dev': normalizeSessionUserShape({
        id: 'usr_local_demo',
        email: 'user@local.dev',
        displayName: 'Demo User',
        role: 'user',
        hasCompletedOnboarding: false,
      }),
      'admin@local.dev': normalizeSessionUserShape({
        id: 'usr_local_admin',
        email: 'admin@local.dev',
        displayName: 'Admin User',
        role: 'admin',
        hasCompletedOnboarding: false,
      }),
      'admin@clipflow.com': normalizeSessionUserShape({
        id: 'usr_local_admin',
        email: 'admin@clipflow.com',
        displayName: 'Admin User',
        role: 'admin',
        hasCompletedOnboarding: false,
      }),
    },
    likes: {},
    bookmarks: [],
    blockedUsers: {},
    uploads: {},
    commentLikesByUser: {
      usr_local_demo: [],
      usr_local_admin: [],
    },
    genres: [
      { id: 'action', slug: 'action', name: 'Action' },
      { id: 'drama', slug: 'drama', name: 'Drama' },
      { id: 'comedy', slug: 'comedy', name: 'Comedy' },
      { id: 'scifi', slug: 'scifi', name: 'Sci-Fi' },
    ],
    comments: [
      {
        id: 'cm_seed_1',
        clipId: '1',
        authorId: 'usr_local_demo',
        authorName: 'Demo User',
        avatar: 'Movie',
        text: 'Great clip!',
        likes: 2,
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        moderationStatus: 'approved',
        isHidden: false,
        reportsCount: 0,
      },
    ],
    clips: [
      {
        id: '1',
        title: 'Interstellar',
        description: 'Space mission',
        clipDescription: 'Docking highlight',
        thumbnailUrl: 'https://example.com/t.jpg',
        videoUrl: 'https://example.com/v.mp4',
        watchUrl: 'https://example.com/watch/interstellar',
        durationSec: 300,
        rating: 8.6,
        genreIds: ['action'],
        genreId: 'action',
        likesCount: 0,
        commentsCount: 1,
        sharesCount: 0,
        bookmarksCount: 0,
        status: 'published',
      },
      {
        id: '2',
        title: 'Arrival',
        description: 'First contact',
        clipDescription: 'Translation scene',
        thumbnailUrl: 'https://example.com/a.jpg',
        videoUrl: 'https://example.com/a.mp4',
        watchUrl: 'https://example.com/watch/arrival',
        durationSec: 220,
        rating: 8.2,
        genreIds: ['scifi'],
        genreId: 'scifi',
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        bookmarksCount: 0,
        status: 'published',
      },
    ],
  }

  function upsertUserRecord(user) {
    const normalizedUser = normalizeSessionUserShape(user)
    state.usersByEmail[normalizedUser.email] = normalizedUser
    return normalizedUser
  }

  function getUserRecord(email, fallbackUser) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (normalizedEmail && state.usersByEmail[normalizedEmail]) {
      return state.usersByEmail[normalizedEmail]
    }

    if (fallbackUser) {
      return upsertUserRecord(fallbackUser)
    }

    return null
  }

  function getCommentLikes(userId) {
    if (!state.commentLikesByUser[userId]) {
      state.commentLikesByUser[userId] = []
    }

    return state.commentLikesByUser[userId]
  }

  function toPublicComment(comment) {
    return {
      ...comment,
      likedByViewer: getCommentLikes(state.sessionUser.id).includes(comment.id),
    }
  }

  function syncClipCounters() {
    state.clips = state.clips.map((clip) => ({
      ...clip,
      likesCount: Object.entries(state.likes).reduce(
        (count, [likedClipId, isLiked]) => count + (isLiked && likedClipId === clip.id ? 1 : 0),
        0
      ),
      commentsCount: state.comments.filter(
        (comment) =>
          comment.clipId === clip.id && !comment.isHidden && comment.moderationStatus !== 'rejected'
      ).length,
      bookmarksCount: state.bookmarks.includes(clip.id) ? 1 : 0,
    }))
  }

  return async (input, init = {}) => {
    const url = parseRequestUrl(input)
    const pathname = url.pathname
    const method = (init.method || 'GET').toUpperCase()

    if (!pathname.startsWith('/api/v1')) {
      return realFetch(input, init)
    }

    const storedSessionUser = readStoredSessionUser()
    if (storedSessionUser) {
      state.sessionUser = upsertUserRecord(storedSessionUser)
    }

    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const body = parseBody(init.body)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const isAdmin = email === 'admin@local.dev' || email === 'admin@clipflow.com'
      const resolvedEmail = email || (isAdmin ? 'admin@local.dev' : 'user@local.dev')
      const fallbackUser = {
        id: isAdmin ? 'usr_local_admin' : 'usr_local_demo',
        email: resolvedEmail,
        displayName: isAdmin ? 'Admin User' : body.displayName || body.name || 'Demo User',
        role: isAdmin ? 'admin' : 'user',
        hasCompletedOnboarding: false,
        selectedGenres: [],
        preferences: normalizePreferences(),
      }
      const existingUser = getUserRecord(resolvedEmail, fallbackUser)
      state.sessionUser = upsertUserRecord({
        ...existingUser,
        displayName: existingUser?.displayName || fallbackUser.displayName,
      })

      return jsonResponse({
        accessToken: `test_access_${state.sessionUser.role}`,
        refreshToken: `test_refresh_${state.sessionUser.role}`,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: state.sessionUser,
      })
    }

    if (pathname === '/api/v1/auth/signup' && method === 'POST') {
      const body = parseBody(init.body)
      state.sessionUser = upsertUserRecord({
        id: `usr_${Date.now()}`,
        email: body.email,
        displayName: body.displayName || 'Movie Explorer',
        role: 'user',
        hasCompletedOnboarding: false,
        selectedGenres: [],
        preferences: normalizePreferences(),
      })
      getCommentLikes(state.sessionUser.id)

      return jsonResponse(
        {
          accessToken: 'test_access_token_signup',
          refreshToken: 'test_refresh_token_signup',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          user: state.sessionUser,
        },
        201
      )
    }

    if (pathname === '/api/v1/auth/refresh' && method === 'POST') {
      return jsonResponse({
        accessToken: `test_access_${state.sessionUser.role}_refreshed`,
        refreshToken: `test_refresh_${state.sessionUser.role}_refreshed`,
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: state.sessionUser,
      })
    }

    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      return emptyResponse(204)
    }

    if (pathname === '/api/v1/genres' && method === 'GET') {
      return jsonResponse({ items: state.genres })
    }

    if (pathname === '/api/v1/feed/clips' && method === 'GET') {
      const selectedGenres = [
        ...url.searchParams.getAll('genreId'),
        ...url.searchParams.getAll('genre'),
      ]
      syncClipCounters()
      return jsonResponse({
        items:
          selectedGenres.length === 0
            ? state.clips
            : state.clips.filter((clip) => {
                const clipGenreIds = Array.isArray(clip.genreIds) ? clip.genreIds : [clip.genreId]
                return clipGenreIds.some((genreId) => selectedGenres.includes(genreId))
              }),
        nextCursor: null,
      })
    }

    if (pathname === '/api/v1/clips' && method === 'GET') {
      syncClipCounters()
      return jsonResponse({ items: state.clips })
    }

    if (pathname === '/api/v1/comments' && method === 'GET') {
      return jsonResponse({
        items: state.comments
          .filter((comment) => !comment.isHidden && comment.moderationStatus !== 'rejected')
          .map(toPublicComment),
      })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/comments$/.test(pathname) && method === 'GET') {
      const clipId = pathname.split('/')[4]
      return jsonResponse({
        items: state.comments
          .filter((comment) => comment.clipId === clipId && !comment.isHidden)
          .map(toPublicComment),
      })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/comments$/.test(pathname) && method === 'POST') {
      const clipId = pathname.split('/')[4]
      const body = parseBody(init.body)
      const created = {
        id: `cm_${Date.now()}`,
        clipId,
        authorId: state.sessionUser.id,
        authorName: state.sessionUser.displayName,
        avatar: 'Movie',
        text: body.body || '',
        likes: 0,
        createdAt: new Date().toISOString(),
        moderationStatus: 'approved',
        isHidden: false,
        reportsCount: 0,
      }
      state.comments.unshift(created)
      syncClipCounters()
      return jsonResponse({ comment: toPublicComment(created) }, 201)
    }

    if (/^\/api\/v1\/comments\/[^/]+\/like$/.test(pathname)) {
      const commentId = pathname.split('/')[4]
      const comment = state.comments.find((item) => item.id === commentId)
      if (!comment) {
        return jsonResponse({ error: { message: 'Comment not found' } }, 404)
      }

      const likedComments = getCommentLikes(state.sessionUser.id)
      const isAlreadyLiked = likedComments.includes(commentId)

      if (method === 'POST' && !isAlreadyLiked) {
        likedComments.push(commentId)
        comment.likes += 1
      }

      if (method === 'DELETE' && isAlreadyLiked) {
        state.commentLikesByUser[state.sessionUser.id] = likedComments.filter(
          (id) => id !== commentId
        )
        comment.likes = Math.max(0, comment.likes - 1)
      }

      return jsonResponse({ comment: toPublicComment(comment) })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/like$/.test(pathname)) {
      const clipId = pathname.split('/')[4]
      if (method === 'POST') {
        state.likes[clipId] = true
      }
      if (method === 'DELETE') {
        state.likes[clipId] = false
      }
      syncClipCounters()
      return jsonResponse({ likes: { ...state.likes } })
    }

    if (/^\/api\/v1\/clips\/[^/]+\/bookmark$/.test(pathname)) {
      const clipId = pathname.split('/')[4]
      if (method === 'POST' && !state.bookmarks.includes(clipId)) {
        state.bookmarks.push(clipId)
      }
      if (method === 'DELETE') {
        state.bookmarks = state.bookmarks.filter((id) => id !== clipId)
      }
      syncClipCounters()
      return jsonResponse({ bookmarks: [...state.bookmarks] })
    }

    if (pathname === '/api/v1/moderation/comments' && method === 'GET') {
      return jsonResponse({
        items: state.comments.map((comment) => ({
          ...toPublicComment(comment),
          clipTitle:
            state.clips.find((clip) => clip.id === comment.clipId)?.title || 'Unknown clip',
          isBlockedAuthor: Boolean(state.blockedUsers[comment.authorId]),
        })),
      })
    }

    if (pathname === '/api/v1/moderation/comments/block-user' && method === 'POST') {
      const body = parseBody(init.body)
      if (body?.authorId) {
        state.blockedUsers[body.authorId] = body.isBlocked !== false
        state.comments = state.comments.map((comment) =>
          comment.authorId === body.authorId
            ? {
                ...comment,
                isHidden: body.isBlocked !== false,
                moderationStatus: body.isBlocked !== false ? 'rejected' : 'approved',
              }
            : comment
        )
      }
      return jsonResponse({ blockedUsers: { ...state.blockedUsers } })
    }

    if (/^\/api\/v1\/moderation\/comments\/by-user\//.test(pathname) && method === 'DELETE') {
      const authorId = pathname.split('/').at(-1)
      const deletedIds = state.comments
        .filter((comment) => comment.authorId === authorId)
        .map((comment) => comment.id)
      state.comments = state.comments.filter((comment) => comment.authorId !== authorId)
      Object.keys(state.commentLikesByUser).forEach((userId) => {
        state.commentLikesByUser[userId] = getCommentLikes(userId).filter(
          (commentId) => !deletedIds.includes(commentId)
        )
      })
      syncClipCounters()
      return jsonResponse({ ok: true })
    }

    if (/^\/api\/v1\/moderation\/comments\//.test(pathname) && method === 'DELETE') {
      const commentId = pathname.split('/').at(-1)
      state.comments = state.comments.filter((comment) => comment.id !== commentId)
      Object.keys(state.commentLikesByUser).forEach((userId) => {
        state.commentLikesByUser[userId] = getCommentLikes(userId).filter((id) => id !== commentId)
      })
      syncClipCounters()
      return jsonResponse({ ok: true })
    }

    if (pathname === '/api/v1/me/bookmarks' && method === 'GET') {
      syncClipCounters()
      return jsonResponse({
        items: state.clips.filter((item) => state.bookmarks.includes(item.id)),
      })
    }

    if (pathname === '/api/v1/me' && method === 'GET') {
      return jsonResponse({
        id: state.sessionUser.id,
        role: state.sessionUser.role,
        displayName: state.sessionUser.displayName,
        email: state.sessionUser.email,
        hasCompletedOnboarding: Boolean(state.sessionUser.hasCompletedOnboarding),
        selectedGenres: normalizeSelectedGenres(state.sessionUser.selectedGenres),
        preferences: normalizePreferences(state.sessionUser.preferences),
        counts: {
          bookmarks: state.bookmarks.length,
          likes: Object.values(state.likes).filter(Boolean).length,
          watched: 0,
        },
      })
    }

    if (pathname === '/api/v1/me' && method === 'PATCH') {
      const body = parseBody(init.body)
      const allowedFields = new Set(['hasCompletedOnboarding', 'selectedGenres', 'preferences'])
      const providedKeys = Object.keys(body || {})

      if (providedKeys.length === 0 || providedKeys.some((key) => !allowedFields.has(key))) {
        return jsonResponse(
          {
            error: {
              message:
                'PATCH /me accepts only hasCompletedOnboarding, selectedGenres and preferences',
            },
          },
          422
        )
      }

      if (
        Object.hasOwn(body, 'hasCompletedOnboarding') &&
        typeof body.hasCompletedOnboarding !== 'boolean'
      ) {
        return jsonResponse({ error: { message: 'hasCompletedOnboarding must be boolean' } }, 422)
      }

      if (Object.hasOwn(body, 'selectedGenres') && !Array.isArray(body.selectedGenres)) {
        return jsonResponse(
          { error: { message: 'selectedGenres must be an array of valid genre ids' } },
          422
        )
      }

      if (Object.hasOwn(body, 'preferences')) {
        if (
          !body.preferences ||
          typeof body.preferences !== 'object' ||
          Array.isArray(body.preferences)
        ) {
          return jsonResponse({ error: { message: 'preferences must be an object' } }, 422)
        }

        if (
          Object.hasOwn(body.preferences, 'notificationsEnabled') &&
          typeof body.preferences.notificationsEnabled !== 'boolean'
        ) {
          return jsonResponse(
            { error: { message: 'preferences.notificationsEnabled must be boolean' } },
            422
          )
        }

        if (
          Object.hasOwn(body.preferences, 'autoplayEnabled') &&
          typeof body.preferences.autoplayEnabled !== 'boolean'
        ) {
          return jsonResponse(
            { error: { message: 'preferences.autoplayEnabled must be boolean' } },
            422
          )
        }

        if (
          Object.hasOwn(body.preferences, 'preferredLanguage') &&
          (typeof body.preferences.preferredLanguage !== 'string' ||
            !body.preferences.preferredLanguage.trim())
        ) {
          return jsonResponse(
            { error: { message: 'preferences.preferredLanguage must be a non-empty string' } },
            422
          )
        }
      }

      state.sessionUser = upsertUserRecord({
        ...state.sessionUser,
        ...(Object.hasOwn(body, 'hasCompletedOnboarding')
          ? { hasCompletedOnboarding: body.hasCompletedOnboarding }
          : {}),
        ...(Object.hasOwn(body, 'selectedGenres')
          ? { selectedGenres: normalizeSelectedGenres(body.selectedGenres) }
          : {}),
        ...(Object.hasOwn(body, 'preferences')
          ? {
              preferences: normalizePreferences({
                ...state.sessionUser.preferences,
                ...body.preferences,
              }),
            }
          : {}),
      })

      return jsonResponse({
        id: state.sessionUser.id,
        role: state.sessionUser.role,
        displayName: state.sessionUser.displayName,
        email: state.sessionUser.email,
        hasCompletedOnboarding: Boolean(state.sessionUser.hasCompletedOnboarding),
        selectedGenres: normalizeSelectedGenres(state.sessionUser.selectedGenres),
        preferences: normalizePreferences(state.sessionUser.preferences),
      })
    }

    if (pathname === '/api/v1/admin/clips/upload-url' && method === 'POST') {
      const uploadId = `upl_${Date.now()}`
      const objectKey = `clips/test/${uploadId}.mp4`
      state.uploads[uploadId] = { uploadId, objectKey, uploaded: false }
      return jsonResponse({
        uploadId,
        objectKey,
        uploadUrl: `${url.origin}/api/v1/uploads/${uploadId}`,
        expiresIn: 900,
        requiredHeaders: { 'Content-Type': 'video/mp4' },
      })
    }

    if (/^\/api\/v1\/uploads\//.test(pathname) && method === 'PUT') {
      const uploadId = pathname.split('/').at(-1)
      if (state.uploads[uploadId]) {
        state.uploads[uploadId].uploaded = true
      }
      return emptyResponse(204)
    }

    if (pathname === '/api/v1/admin/clips' && method === 'POST') {
      const body = parseBody(init.body)
      const hasLegacyGenreAliases = Object.hasOwn(body, 'genreId') || Object.hasOwn(body, 'genres')

      if (hasLegacyGenreAliases) {
        return jsonResponse(
          {
            error: {
              message: 'Use genreIds only; legacy genreId and genres aliases are not supported',
            },
          },
          422
        )
      }

      const genreIds = Array.isArray(body.genreIds)
        ? [...new Set(body.genreIds.map((genreId) => String(genreId).trim()).filter(Boolean))]
        : []

      if (genreIds.length === 0) {
        return jsonResponse(
          {
            error: {
              message: 'genreIds is required and must contain at least one valid genre',
            },
          },
          422
        )
      }

      const created = {
        id: `clip_${Date.now()}`,
        title: body.title,
        description: body.description,
        clipDescription: body.clipDescription,
        thumbnailUrl: body.thumbnailUrl || '',
        videoUrl: 'https://example.com/uploaded.mp4',
        watchUrl: body.watchUrl,
        durationSec: Number(body.durationSec) || 0,
        rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : null,
        genreIds,
        genreId: genreIds[0],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        bookmarksCount: 0,
        status: body.status || 'draft',
      }
      state.clips.unshift(created)
      return jsonResponse({ clip: created }, 201)
    }

    if (pathname === '/api/v1/admin/clips' && method === 'GET') {
      return jsonResponse({ items: state.clips })
    }

    return jsonResponse({})
  }
}

beforeEach(() => {
  window.localStorage.clear()
  globalThis.fetch = createApiTestFetch()
})

afterEach(() => {
  cleanup()
})
