import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'

import { createStorageAdapter } from './storage/create-storage-adapter.mjs'

const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = process.env.API_PREFIX || '/api/v1'
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_CLIP_SIZE_BYTES = Number(process.env.MAX_CLIP_SIZE_BYTES || 250 * 1024 * 1024)
const CORS_ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const CORS_ALLOW_CREDENTIALS = String(process.env.CORS_ALLOW_CREDENTIALS || 'true') === 'true'
const ALLOWED_VIDEO_TYPES = (
  process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/webm,video/quicktime'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const now = () => new Date().toISOString()

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function createAccessToken(user) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    })
  )

  return `${header}.${payload}.local`
}

function getOrigin(req) {
  const forwardedProto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0].trim()
      : ''
  const protocol = forwardedProto || 'http'
  const host = req.headers.host || `localhost:${PORT}`
  return `${protocol}://${host}`
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
    const nextGenreId = normalizeGenreId(value)

    if (!nextGenreId || seen.has(nextGenreId)) {
      return
    }

    seen.add(nextGenreId)
    normalized.push(nextGenreId)
  })

  return normalized
}

function normalizeRating(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return null
  }

  return Math.round(parsed * 10) / 10
}

const genres = [
  { id: 'action', slug: 'action', name: 'Action' },
  { id: 'comedy', slug: 'comedy', name: 'Comedy' },
  { id: 'drama', slug: 'drama', name: 'Drama' },
  { id: 'horror', slug: 'horror', name: 'Horror' },
  { id: 'scifi', slug: 'scifi', name: 'Sci-Fi' },
  { id: 'romance', slug: 'romance', name: 'Romance' },
  { id: 'thriller', slug: 'thriller', name: 'Thriller' },
  { id: 'animation', slug: 'animation', name: 'Animation' },
  { id: 'documentary', slug: 'documentary', name: 'Documentary' },
  { id: 'fantasy', slug: 'fantasy', name: 'Fantasy' },
  { id: 'crime', slug: 'crime', name: 'Crime' },
  { id: 'adventure', slug: 'adventure', name: 'Adventure' },
]

const DEFAULT_USER_PREFERENCES = Object.freeze({
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
})

const VALID_USER_PATCH_FIELDS = new Set(['hasCompletedOnboarding', 'selectedGenres', 'preferences'])

const validGenreIds = new Set(genres.map((genre) => genre.id))

const users = [
  {
    id: 'usr_local_demo',
    email: 'user@local.dev',
    displayName: 'Demo User',
    avatarUrl: null,
    role: 'user',
    hasCompletedOnboarding: false,
    selectedGenres: [],
    preferences: DEFAULT_USER_PREFERENCES,
    password: 'demo-password',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'usr_local_admin',
    email: 'admin@local.dev',
    displayName: 'Admin User',
    avatarUrl: null,
    role: 'admin',
    hasCompletedOnboarding: false,
    selectedGenres: [],
    preferences: DEFAULT_USER_PREFERENCES,
    password: 'demo-password',
    createdAt: now(),
    updatedAt: now(),
  },
]

const usersById = new Map(users.map((user) => [user.id, normalizeStoredUser(user)]))

const seedClips = [
  {
    id: 'clip_1',
    authorId: 'usr_local_admin',
    title: 'Interstellar docking',
    description: 'Docking sequence highlight',
    clipDescription: 'Docking sequence highlight',
    thumbnailUrl: 'https://placehold.co/600x800?text=Interstellar',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    watchUrl: 'https://example.com/watch/interstellar',
    durationSec: 180,
    rating: 8.7,
    genreIds: ['scifi'],
    status: 'published',
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    objectKey: 'seed/interstellar.mp4',
  },
  {
    id: 'clip_2',
    authorId: 'usr_local_admin',
    title: 'Whiplash rehearsal',
    description: 'Not quite my tempo',
    clipDescription: 'Not quite my tempo',
    thumbnailUrl: 'https://placehold.co/600x800?text=Whiplash',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    watchUrl: 'https://example.com/watch/whiplash',
    durationSec: 95,
    rating: 8.3,
    genreIds: ['drama'],
    status: 'published',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    objectKey: 'seed/whiplash.mp4',
  },
]

const clips = [...seedClips]

const comments = [
  {
    id: 'cm_seed_1',
    clipId: 'clip_1',
    authorId: 'usr_local_demo',
    authorName: 'Demo User',
    avatar: 'Movie',
    text: 'Great sequence',
    likes: 0,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    moderationStatus: 'approved',
    isHidden: false,
    reportsCount: 0,
  },
]

const likesByUser = new Map(users.map((user) => [user.id, new Set()]))
const commentLikesByUser = new Map(users.map((user) => [user.id, new Set()]))
const bookmarksByUser = new Map(users.map((user) => [user.id, new Set()]))
const blockedUsers = new Set()
const refreshSessions = new Map()
const accessSessions = new Map()
const uploadSessions = new Map()

const storageAdapter = createStorageAdapter({
  apiPrefix: API_PREFIX,
  env: process.env,
  getOrigin,
})

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendNoContent(res, statusCode = 204) {
  res.writeHead(statusCode)
  res.end()
}

function sendError(res, statusCode, message, code = 'BAD_REQUEST', details) {
  sendJson(res, statusCode, {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: randomUUID(),
    },
  })
}

function getCorsOrigin(req) {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''
  if (!requestOrigin) {
    return CORS_ALLOWED_ORIGINS[0] || 'http://localhost:5173'
  }

  if (CORS_ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

function applyCorsHeaders(req, res) {
  const corsOrigin = getCorsOrigin(req)
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  }
  res.setHeader('Vary', 'Origin')
  if (CORS_ALLOW_CREDENTIALS) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
}

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJsonBody(req) {
  const buffer = await readBodyBuffer(req)
  if (!buffer.length) {
    return {}
  }

  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function normalizeUserPreferences(value = {}) {
  const safeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return {
    notificationsEnabled:
      typeof safeValue.notificationsEnabled === 'boolean'
        ? safeValue.notificationsEnabled
        : DEFAULT_USER_PREFERENCES.notificationsEnabled,
    autoplayEnabled:
      typeof safeValue.autoplayEnabled === 'boolean'
        ? safeValue.autoplayEnabled
        : DEFAULT_USER_PREFERENCES.autoplayEnabled,
    preferredLanguage:
      typeof safeValue.preferredLanguage === 'string' && safeValue.preferredLanguage.trim()
        ? safeValue.preferredLanguage.trim()
        : DEFAULT_USER_PREFERENCES.preferredLanguage,
  }
}

function normalizeStoredUser(user) {
  return {
    ...user,
    selectedGenres: normalizeGenreIds(user.selectedGenres).filter((genreId) =>
      validGenreIds.has(genreId)
    ),
    preferences: normalizeUserPreferences(user.preferences),
  }
}

function normalizeSelectedGenresPatch(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      message: 'selectedGenres must be an array of valid genre ids',
    }
  }

  const nextGenreIds = []
  const seen = new Set()

  for (const entry of value) {
    const genreId = normalizeGenreId(entry)

    if (!genreId || !validGenreIds.has(genreId)) {
      return {
        ok: false,
        message: 'selectedGenres must contain only known genre ids',
      }
    }

    if (seen.has(genreId)) {
      continue
    }

    seen.add(genreId)
    nextGenreIds.push(genreId)
  }

  return { ok: true, value: nextGenreIds }
}

function normalizePreferencesPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      message: 'preferences must be an object',
    }
  }

  const allowedKeys = new Set(['notificationsEnabled', 'autoplayEnabled', 'preferredLanguage'])
  const nextPreferences = {}

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        message: 'preferences contains unsupported fields',
      }
    }
  }

  if (Object.hasOwn(value, 'notificationsEnabled')) {
    if (typeof value.notificationsEnabled !== 'boolean') {
      return {
        ok: false,
        message: 'preferences.notificationsEnabled must be boolean',
      }
    }

    nextPreferences.notificationsEnabled = value.notificationsEnabled
  }

  if (Object.hasOwn(value, 'autoplayEnabled')) {
    if (typeof value.autoplayEnabled !== 'boolean') {
      return {
        ok: false,
        message: 'preferences.autoplayEnabled must be boolean',
      }
    }

    nextPreferences.autoplayEnabled = value.autoplayEnabled
  }

  if (Object.hasOwn(value, 'preferredLanguage')) {
    if (typeof value.preferredLanguage !== 'string' || !value.preferredLanguage.trim()) {
      return {
        ok: false,
        message: 'preferences.preferredLanguage must be a non-empty string',
      }
    }

    nextPreferences.preferredLanguage = value.preferredLanguage.trim()
  }

  return { ok: true, value: nextPreferences }
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
    selectedGenres: normalizeGenreIds(user.selectedGenres).filter((genreId) =>
      validGenreIds.has(genreId)
    ),
    preferences: normalizeUserPreferences(user.preferences),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function createSessionPayload(user) {
  const accessToken = createAccessToken(user)
  const refreshToken = `refresh_${randomUUID()}`
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString()

  accessSessions.set(accessToken, {
    userId: user.id,
    expiresAt,
  })

  refreshSessions.set(refreshToken, {
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
  })

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresAt,
    user: toPublicUser(user),
  }
}

function revokeRefreshToken(refreshToken) {
  if (!refreshToken) {
    return
  }

  refreshSessions.delete(refreshToken)
}

function revokeAccessToken(accessToken) {
  if (!accessToken) {
    return
  }

  accessSessions.delete(accessToken)
}

function getBearerToken(req) {
  const header =
    typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : ''
  if (!header.toLowerCase().startsWith('bearer ')) {
    return ''
  }

  return header.slice('bearer '.length).trim()
}

function getOptionalRequestUser(req) {
  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return null
  }

  const session = accessSessions.get(accessToken)
  if (!session) {
    return null
  }

  const expiresAt = Date.parse(session.expiresAt)
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    accessSessions.delete(accessToken)
    return null
  }

  return usersById.get(session.userId) || null
}

function requireUser(req, res) {
  const user = getOptionalRequestUser(req)
  if (!user) {
    sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED')
    return null
  }

  return user
}

function requireAdmin(req, res) {
  const user = requireUser(req, res)
  if (!user) {
    return null
  }

  if (user.role !== 'admin') {
    sendError(res, 403, 'Admin access required', 'FORBIDDEN')
    return null
  }

  return user
}

function ensureUserSet(map, userId) {
  if (!map.has(userId)) {
    map.set(userId, new Set())
  }

  return map.get(userId)
}

function getLikeCount(clipId) {
  let count = 0
  for (const likedSet of likesByUser.values()) {
    if (likedSet.has(clipId)) {
      count += 1
    }
  }
  return count
}

function getBookmarkCount(clipId) {
  let count = 0
  for (const bookmarkSet of bookmarksByUser.values()) {
    if (bookmarkSet.has(clipId)) {
      count += 1
    }
  }
  return count
}

function hasCommentLike(userId, commentId) {
  if (!userId) {
    return false
  }

  const likedSet = commentLikesByUser.get(userId)
  return Boolean(likedSet?.has(commentId))
}

function removeCommentLikes(commentId) {
  for (const likedSet of commentLikesByUser.values()) {
    likedSet.delete(commentId)
  }
}

function getCommentCount(clipId) {
  return comments.filter(
    (comment) =>
      comment.clipId === clipId && !comment.isHidden && comment.moderationStatus !== 'rejected'
  ).length
}

function resolveClipGenreIds(clip) {
  return normalizeGenreIds(clip?.genreIds, clip?.genreId, clip?.genres)
}

function toClipResponse(clip) {
  const genreIds = resolveClipGenreIds(clip)
  const genreId = genreIds[0] || 'unknown'

  return {
    id: clip.id,
    authorId: clip.authorId,
    title: clip.title,
    description: clip.description,
    clipDescription: clip.clipDescription,
    thumbnailUrl: clip.thumbnailUrl || '',
    videoUrl: clip.videoUrl || '',
    watchUrl: clip.watchUrl || '#',
    durationSec: Number(clip.durationSec) || 0,
    rating: normalizeRating(clip.rating),
    genreIds,
    genreId,
    likesCount: getLikeCount(clip.id),
    commentsCount: getCommentCount(clip.id),
    sharesCount: Number(clip.sharesCount) || 0,
    bookmarksCount: getBookmarkCount(clip.id),
    status: clip.status || 'draft',
    createdAt: clip.createdAt,
    updatedAt: clip.updatedAt,
    objectKey: clip.objectKey,
  }
}

function toPublicComment(comment, viewer = null) {
  return {
    id: comment.id,
    clipId: comment.clipId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    avatar: comment.avatar || 'Movie',
    text: comment.text,
    likes: Number(comment.likes) || 0,
    likedByViewer: hasCommentLike(viewer?.id, comment.id),
    createdAt: comment.createdAt,
    moderationStatus: comment.moderationStatus,
    isHidden: Boolean(comment.isHidden),
    reportsCount: Number(comment.reportsCount) || 0,
  }
}

function summarizeLikes(set) {
  return [...set].reduce((acc, clipId) => {
    acc[clipId] = true
    return acc
  }, {})
}

function validateClipUpload({ contentType, size }) {
  if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
    return `Unsupported file type: ${contentType || 'unknown'}`
  }

  if (!Number.isFinite(size) || size <= 0) {
    return 'File size must be a positive number'
  }

  if (size > MAX_CLIP_SIZE_BYTES) {
    return `File is too large. Max allowed size is ${MAX_CLIP_SIZE_BYTES} bytes`
  }

  return null
}

function getUploadSession(uploadId, { requireActiveUpload = false } = {}) {
  const session = uploadSessions.get(uploadId)
  if (!session) {
    return null
  }

  if (!requireActiveUpload) {
    return session
  }

  const expiresAt = Date.parse(session.uploadExpiresAt)
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
    uploadSessions.delete(uploadId)
    return null
  }

  return session
}

function validateCommentBody(text) {
  const normalized = typeof text === 'string' ? text.trim() : ''
  if (!normalized) {
    return 'Comment body is required'
  }

  if (normalized.length > 500) {
    return 'Comment body must be 500 characters or fewer'
  }

  return ''
}

function findUserByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null
}

function filterClipsByGenre(url) {
  const selectedGenreIds = [
    ...url.searchParams.getAll('genreId'),
    ...url.searchParams.getAll('genre'),
  ]
    .map(normalizeGenreId)
    .filter(Boolean)

  return clips.filter((clip) => {
    if (selectedGenreIds.length === 0) {
      return true
    }

    const clipGenreIds = resolveClipGenreIds(clip)
    return clipGenreIds.some((genreId) => selectedGenreIds.includes(genreId))
  })
}

function handleFeedRead(url, res) {
  sendJson(res, 200, {
    items: filterClipsByGenre(url).map(toClipResponse),
    nextCursor: null,
  })
}

function handleCatalogRead(url, res) {
  const items = filterClipsByGenre(url).map(toClipResponse)
  sendJson(res, 200, { items })
}

function handleGenresRead(res) {
  sendJson(res, 200, {
    items: genres.map((genre) => ({
      id: genre.id,
      slug: genre.slug,
      name: genre.name,
    })),
  })
}

async function handleAuthLogin(req, res) {
  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const user = email ? findUserByEmail(email) : null
  if (!user || user.password !== password) {
    sendError(res, 401, 'Invalid email or password', 'UNAUTHORIZED')
    return
  }

  sendJson(res, 200, createSessionPayload(user))
}

async function handleAuthSignup(req, res) {
  const body = await readJsonBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !displayName || !password) {
    sendError(res, 422, 'displayName, email and password are required', 'VALIDATION_ERROR')
    return
  }

  if (findUserByEmail(email)) {
    sendError(res, 409, 'User already exists', 'CONFLICT')
    return
  }

  const user = normalizeStoredUser({
    id: `usr_${randomUUID()}`,
    email,
    displayName,
    avatarUrl: null,
    role: 'user',
    hasCompletedOnboarding: false,
    selectedGenres: [],
    preferences: DEFAULT_USER_PREFERENCES,
    password,
    createdAt: now(),
    updatedAt: now(),
  })

  users.push(user)
  usersById.set(user.id, user)
  likesByUser.set(user.id, new Set())
  commentLikesByUser.set(user.id, new Set())
  bookmarksByUser.set(user.id, new Set())

  sendJson(res, 201, createSessionPayload(user))
}

async function handleAuthRefresh(req, res) {
  const body = await readJsonBody(req)
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : ''
  const session = refreshSessions.get(refreshToken)

  if (!session) {
    sendError(res, 401, 'Invalid refresh token', 'UNAUTHORIZED')
    return
  }

  const expiresAt = Date.parse(session.expiresAt)
  if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
    refreshSessions.delete(refreshToken)
    sendError(res, 401, 'Refresh token expired', 'UNAUTHORIZED')
    return
  }

  const user = usersById.get(session.userId)
  if (!user) {
    refreshSessions.delete(refreshToken)
    sendError(res, 401, 'Session user not found', 'UNAUTHORIZED')
    return
  }

  refreshSessions.delete(refreshToken)
  sendJson(res, 200, createSessionPayload(user))
}

async function handleAuthLogout(req, res) {
  const body = await readJsonBody(req)
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : ''
  const accessToken = getBearerToken(req)

  revokeRefreshToken(refreshToken)
  revokeAccessToken(accessToken)
  sendNoContent(res)
}

function handleMeRead(req, res) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const bookmarkCount = ensureUserSet(bookmarksByUser, user.id).size
  const likeCount = ensureUserSet(likesByUser, user.id).size

  sendJson(res, 200, {
    ...toPublicUser(user),
    counts: {
      bookmarks: bookmarkCount,
      likes: likeCount,
      watched: 0,
    },
  })
}

async function handleMePatch(req, res) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const body = await readJsonBody(req)
  const providedKeys = Object.keys(body || {})

  if (providedKeys.length === 0 || providedKeys.some((key) => !VALID_USER_PATCH_FIELDS.has(key))) {
    sendError(
      res,
      422,
      'PATCH /me accepts only hasCompletedOnboarding, selectedGenres and preferences',
      'VALIDATION_ERROR'
    )
    return
  }

  if (
    Object.hasOwn(body, 'hasCompletedOnboarding') &&
    typeof body.hasCompletedOnboarding !== 'boolean'
  ) {
    sendError(res, 422, 'hasCompletedOnboarding must be boolean', 'VALIDATION_ERROR')
    return
  }

  let nextSelectedGenres = normalizeGenreIds(user.selectedGenres).filter((genreId) =>
    validGenreIds.has(genreId)
  )

  if (Object.hasOwn(body, 'selectedGenres')) {
    const normalizedGenres = normalizeSelectedGenresPatch(body.selectedGenres)

    if (!normalizedGenres.ok) {
      sendError(res, 422, normalizedGenres.message, 'VALIDATION_ERROR')
      return
    }

    nextSelectedGenres = normalizedGenres.value
  }

  let nextPreferences = normalizeUserPreferences(user.preferences)

  if (Object.hasOwn(body, 'preferences')) {
    const normalizedPreferences = normalizePreferencesPatch(body.preferences)

    if (!normalizedPreferences.ok) {
      sendError(res, 422, normalizedPreferences.message, 'VALIDATION_ERROR')
      return
    }

    nextPreferences = normalizeUserPreferences({
      ...nextPreferences,
      ...normalizedPreferences.value,
    })
  }

  if (Object.hasOwn(body, 'hasCompletedOnboarding')) {
    user.hasCompletedOnboarding = body.hasCompletedOnboarding
  }

  user.selectedGenres = nextSelectedGenres
  user.preferences = nextPreferences
  user.updatedAt = now()

  sendJson(res, 200, toPublicUser(user))
}

function handleBookmarksRead(req, res) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const bookmarkIds = ensureUserSet(bookmarksByUser, user.id)
  sendJson(res, 200, {
    items: clips.filter((clip) => bookmarkIds.has(clip.id)).map(toClipResponse),
  })
}

function handleCommentsRead(req, res) {
  const viewer = getOptionalRequestUser(req)

  sendJson(res, 200, {
    items: comments
      .filter((comment) => !comment.isHidden && comment.moderationStatus !== 'rejected')
      .map((comment) => toPublicComment(comment, viewer)),
  })
}

function handleClipCommentsRead(req, clipId, res) {
  const viewer = getOptionalRequestUser(req)

  sendJson(res, 200, {
    items: comments
      .filter((comment) => comment.clipId === clipId && !comment.isHidden)
      .map((comment) => toPublicComment(comment, viewer)),
  })
}

async function handleCommentCreate(req, res, clipId) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  if (blockedUsers.has(user.id)) {
    sendError(res, 403, 'Comment publishing is blocked for this user', 'FORBIDDEN')
    return
  }

  const clip = clips.find((item) => item.id === clipId)
  if (!clip) {
    sendError(res, 404, 'Clip not found', 'NOT_FOUND')
    return
  }

  const body = await readJsonBody(req)
  const validationError = validateCommentBody(body.body)
  if (validationError) {
    sendError(res, 422, validationError, 'VALIDATION_ERROR')
    return
  }

  const comment = {
    id: `cm_${randomUUID()}`,
    clipId,
    authorId: user.id,
    authorName: user.displayName,
    avatar: 'Movie',
    text: body.body.trim(),
    likes: 0,
    createdAt: now(),
    moderationStatus: 'approved',
    isHidden: false,
    reportsCount: 0,
  }

  comments.unshift(comment)
  sendJson(res, 201, { comment: toPublicComment(comment, user) })
}

function handleCommentLikeToggle(req, res, commentId) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const comment = comments.find(
    (item) => item.id === commentId && !item.isHidden && item.moderationStatus !== 'rejected'
  )
  if (!comment) {
    sendError(res, 404, 'Comment not found', 'NOT_FOUND')
    return
  }

  const likedSet = ensureUserSet(commentLikesByUser, user.id)
  const isAlreadyLiked = likedSet.has(commentId)

  if (req.method === 'POST' && !isAlreadyLiked) {
    likedSet.add(commentId)
    comment.likes = (Number(comment.likes) || 0) + 1
  }

  if (req.method === 'DELETE' && isAlreadyLiked) {
    likedSet.delete(commentId)
    comment.likes = Math.max(0, (Number(comment.likes) || 0) - 1)
  }

  sendJson(res, 200, { comment: toPublicComment(comment, user) })
}

function handleLikeToggle(req, res, clipId) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const clip = clips.find((item) => item.id === clipId)
  if (!clip) {
    sendError(res, 404, 'Clip not found', 'NOT_FOUND')
    return
  }

  const likedSet = ensureUserSet(likesByUser, user.id)
  if (req.method === 'POST') {
    likedSet.add(clipId)
  }
  if (req.method === 'DELETE') {
    likedSet.delete(clipId)
  }

  sendJson(res, 200, { likes: summarizeLikes(likedSet) })
}

function handleBookmarkToggle(req, res, clipId) {
  const user = requireUser(req, res)
  if (!user) {
    return
  }

  const clip = clips.find((item) => item.id === clipId)
  if (!clip) {
    sendError(res, 404, 'Clip not found', 'NOT_FOUND')
    return
  }

  const bookmarkedSet = ensureUserSet(bookmarksByUser, user.id)
  if (req.method === 'POST') {
    bookmarkedSet.add(clipId)
  }
  if (req.method === 'DELETE') {
    bookmarkedSet.delete(clipId)
  }

  sendJson(res, 200, { bookmarks: [...bookmarkedSet] })
}

function handleModerationRead(req, res) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  sendJson(res, 200, {
    items: comments.map((comment) => ({
      ...toPublicComment(comment, admin),
      clipTitle: clips.find((clip) => clip.id === comment.clipId)?.title || 'Unknown clip',
      isBlockedAuthor: blockedUsers.has(comment.authorId),
    })),
  })
}

async function handleBlockUser(req, res) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const body = await readJsonBody(req)
  const authorId = typeof body.authorId === 'string' ? body.authorId.trim() : ''
  const isBlocked = body.isBlocked !== false

  if (!authorId) {
    sendError(res, 422, 'authorId is required', 'VALIDATION_ERROR')
    return
  }

  if (isBlocked) {
    blockedUsers.add(authorId)
  } else {
    blockedUsers.delete(authorId)
  }

  comments.forEach((comment) => {
    if (comment.authorId !== authorId) {
      return
    }

    comment.isHidden = isBlocked
    comment.moderationStatus = isBlocked ? 'rejected' : 'approved'
  })

  sendJson(res, 200, {
    blockedUsers: [...blockedUsers].reduce((acc, userId) => {
      acc[userId] = true
      return acc
    }, {}),
  })
}

function handleDeleteComment(req, res, commentId) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const index = comments.findIndex((comment) => comment.id === commentId)
  if (index < 0) {
    sendError(res, 404, 'Comment not found', 'NOT_FOUND')
    return
  }

  const [removedComment] = comments.splice(index, 1)
  if (removedComment) {
    removeCommentLikes(removedComment.id)
  }

  sendJson(res, 200, { ok: true })
}

function handleDeleteCommentsByUser(req, res, authorId) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const removedCommentIds = comments
    .filter((comment) => comment.authorId === authorId)
    .map((comment) => comment.id)
  removedCommentIds.forEach(removeCommentLikes)

  const nextComments = comments.filter((comment) => comment.authorId !== authorId)
  comments.length = 0
  comments.push(...nextComments)
  sendJson(res, 200, { ok: true })
}

async function handleUploadUrlCreate(req, res) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const body = await readJsonBody(req)
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : ''
  const size = Number(body.size)
  const validationError = validateClipUpload({ contentType, size })

  if (validationError) {
    sendError(res, 422, validationError, 'VALIDATION_ERROR')
    return
  }

  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '.mp4'
  const uploadId = `upl_${randomUUID()}`
  const objectKey = `clips/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`

  uploadSessions.set(uploadId, {
    id: uploadId,
    objectKey,
    contentType,
    size,
    userId: admin.id,
    status: 'created',
    createdAt: now(),
    uploadExpiresAt: null,
  })

  const session = getUploadSession(uploadId)
  const storageUpload = await storageAdapter.createUploadSession({
    contentType,
    objectKey,
    req,
    session,
    size,
    uploadId,
  })

  session.requiredHeaders = storageUpload.requiredHeaders || {
    'Content-Type': contentType,
  }
  session.uploadUrl = storageUpload.uploadUrl
  session.uploadExpiresAt = new Date(
    Date.now() + Number(storageUpload.expiresIn || 900) * 1000
  ).toISOString()

  sendJson(res, 200, {
    uploadId,
    objectKey,
    uploadUrl: storageUpload.uploadUrl,
    expiresIn: Number(storageUpload.expiresIn || 900),
    requiredHeaders: session.requiredHeaders,
  })
}

async function handleUploadPut(req, res, uploadId) {
  if (!storageAdapter.supportsLocalUpload) {
    sendError(res, 404, 'Upload session not found', 'NOT_FOUND')
    return
  }

  const session = getUploadSession(uploadId, { requireActiveUpload: true })
  if (!session) {
    sendError(res, 404, 'Upload session not found', 'NOT_FOUND')
    return
  }

  const contentType =
    typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].trim() : ''
  if (contentType !== session.contentType) {
    sendError(res, 422, 'Content-Type does not match upload session', 'VALIDATION_ERROR')
    return
  }

  try {
    await storageAdapter.finalizeUploadedObject({
      maxSizeBytes: MAX_CLIP_SIZE_BYTES,
      req,
      session,
    })
  } catch (error) {
    if (error?.code === 'EMPTY_BODY') {
      sendError(res, 422, 'Upload body is empty', 'VALIDATION_ERROR')
      return
    }

    if (error?.code === 'PAYLOAD_TOO_LARGE') {
      sendError(res, 422, 'Uploaded asset exceeds size limit', 'VALIDATION_ERROR')
      return
    }

    throw error
  }

  session.status = 'uploaded'
  session.uploadedAt = now()

  sendNoContent(res)
}

async function handleAssetRead(res, uploadId) {
  if (!storageAdapter.supportsAssetRead) {
    sendError(res, 404, 'Asset not found', 'NOT_FOUND')
    return
  }

  const session = getUploadSession(uploadId)
  if (!session) {
    sendError(res, 404, 'Asset not found', 'NOT_FOUND')
    return
  }

  const wasSent = await storageAdapter.sendAsset({
    res,
    session,
  })

  if (!wasSent) {
    sendError(res, 404, 'Asset not found', 'NOT_FOUND')
  }
}

async function handleAdminClipCreate(req, res) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const body = await readJsonBody(req)
  const requiredFields = ['title', 'description', 'clipDescription', 'watchUrl', 'objectKey']
  const missingFields = requiredFields.filter((field) => {
    const value = body[field]
    return typeof value !== 'string' || !value.trim()
  })

  if (missingFields.length > 0) {
    sendError(res, 422, `Missing required fields: ${missingFields.join(', ')}`, 'VALIDATION_ERROR')
    return
  }

  const rating = normalizeRating(body.rating)
  if (rating === null) {
    sendError(res, 422, 'rating is required and must be between 0 and 10', 'VALIDATION_ERROR')
    return
  }

  const hasLegacyGenreAliases = Object.hasOwn(body, 'genreId') || Object.hasOwn(body, 'genres')
  if (hasLegacyGenreAliases) {
    sendError(
      res,
      422,
      'Use genreIds only; legacy genreId and genres aliases are not supported',
      'VALIDATION_ERROR'
    )
    return
  }

  const genreIds = normalizeGenreIds(body.genreIds)
  if (genreIds.length === 0) {
    sendError(
      res,
      422,
      'genreIds is required and must contain at least one valid genre',
      'VALIDATION_ERROR'
    )
    return
  }

  const hasInvalidGenreId = genreIds.some(
    (genreId) => !genres.some((genre) => genre.id === genreId)
  )
  if (hasInvalidGenreId) {
    sendError(res, 422, 'genreIds must contain only valid genres', 'VALIDATION_ERROR')
    return
  }

  const uploadId = typeof body.uploadId === 'string' ? body.uploadId.trim() : ''
  const session = uploadId
    ? getUploadSession(uploadId)
    : [...uploadSessions.values()].find((item) => item.objectKey === body.objectKey)
  if (!session || session.objectKey !== body.objectKey) {
    sendError(res, 424, 'Upload session was not created for this objectKey', 'BAD_REQUEST')
    return
  }

  const uploadedObjectExists = await storageAdapter.assertObjectExists({ session })
  if (!uploadedObjectExists) {
    sendError(res, 424, 'Uploaded object was not found in storage', 'BAD_REQUEST')
    return
  }

  session.status = 'uploaded'
  session.uploadedAt = session.uploadedAt || now()

  if (clips.some((clip) => clip.objectKey === body.objectKey)) {
    sendError(res, 409, 'Clip metadata already exists for this objectKey', 'CONFLICT')
    return
  }

  const clipId = `clip_${randomUUID()}`
  const createdAt = now()
  const clip = {
    id: clipId,
    authorId: admin.id,
    title: body.title.trim(),
    description: body.description.trim(),
    clipDescription: body.clipDescription.trim(),
    thumbnailUrl:
      typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim()
        ? body.thumbnailUrl.trim()
        : 'https://placehold.co/600x800?text=ClipFlow',
    videoUrl: storageAdapter.getPublicAssetUrl({ req, session }),
    watchUrl: body.watchUrl.trim(),
    durationSec: Number(body.durationSec) || 0,
    rating,
    genreIds,
    status: typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'draft',
    createdAt,
    updatedAt: createdAt,
    objectKey: session.objectKey,
  }

  clips.unshift(clip)
  sendJson(res, 201, { clip: toClipResponse(clip) })
}

async function handleAdminClipUpdate(req, res, clipId) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  const clip = clips.find((item) => item.id === clipId)
  if (!clip) {
    sendError(res, 404, 'Clip not found', 'NOT_FOUND')
    return
  }

  const body = await readJsonBody(req)
  const hasLegacyGenreAliases = Object.hasOwn(body, 'genreId') || Object.hasOwn(body, 'genres')
  if (hasLegacyGenreAliases) {
    sendError(
      res,
      422,
      'Use genreIds only; legacy genreId and genres aliases are not supported',
      'VALIDATION_ERROR'
    )
    return
  }

  const hasGenrePatch = Object.hasOwn(body, 'genreIds')
  const nextGenreIds = hasGenrePatch ? normalizeGenreIds(body.genreIds) : clip.genreIds

  if (hasGenrePatch && nextGenreIds.length === 0) {
    sendError(
      res,
      422,
      'genreIds is required and must contain at least one valid genre',
      'VALIDATION_ERROR'
    )
    return
  }

  const hasInvalidGenreId = nextGenreIds.some(
    (genreId) => !genres.some((genre) => genre.id === genreId)
  )
  if (hasGenrePatch && hasInvalidGenreId) {
    sendError(res, 422, 'genreIds must contain only valid genres', 'VALIDATION_ERROR')
    return
  }

  const nextTitle = Object.hasOwn(body, 'title')
    ? typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : ''
    : clip.title
  const nextDescription = Object.hasOwn(body, 'description')
    ? typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : ''
    : clip.description
  const nextClipDescription = Object.hasOwn(body, 'clipDescription')
    ? typeof body.clipDescription === 'string' && body.clipDescription.trim()
      ? body.clipDescription.trim()
      : ''
    : clip.clipDescription
  const nextWatchUrl = Object.hasOwn(body, 'watchUrl')
    ? typeof body.watchUrl === 'string' && body.watchUrl.trim()
      ? body.watchUrl.trim()
      : ''
    : clip.watchUrl

  if (!nextTitle || !nextDescription || !nextClipDescription || !nextWatchUrl) {
    sendError(
      res,
      422,
      'title, description, clipDescription and watchUrl must be non-empty when provided',
      'VALIDATION_ERROR'
    )
    return
  }

  const nextRating = Object.hasOwn(body, 'rating') ? normalizeRating(body.rating) : clip.rating
  if (Object.hasOwn(body, 'rating') && nextRating === null) {
    sendError(res, 422, 'rating is required and must be between 0 and 10', 'VALIDATION_ERROR')
    return
  }

  clip.title = nextTitle
  clip.description = nextDescription
  clip.clipDescription = nextClipDescription
  clip.watchUrl = nextWatchUrl
  clip.durationSec = Object.hasOwn(body, 'durationSec')
    ? Number(body.durationSec) || 0
    : clip.durationSec
  clip.rating = nextRating
  clip.genreIds = nextGenreIds
  clip.thumbnailUrl =
    typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim()
      ? body.thumbnailUrl.trim()
      : clip.thumbnailUrl
  clip.status =
    typeof body.status === 'string' && body.status.trim() ? body.status.trim() : clip.status
  clip.updatedAt = now()

  sendJson(res, 200, { clip: toClipResponse(clip) })
}

function handleAdminClipsRead(req, res) {
  const admin = requireAdmin(req, res)
  if (!admin) {
    return
  }

  sendJson(res, 200, { items: clips.map(toClipResponse) })
}

const server = http.createServer(async (req, res) => {
  try {
    applyCorsHeaders(req, res)

    if (req.method === 'OPTIONS') {
      const requestedHeaders =
        typeof req.headers['access-control-request-headers'] === 'string' &&
        req.headers['access-control-request-headers'].trim()
          ? req.headers['access-control-request-headers'].trim()
          : 'Content-Type, Authorization, Content-Length'

      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,PUT,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': requestedHeaders,
        'Access-Control-Max-Age': '600',
        ...(req.headers['access-control-request-private-network'] === 'true'
          ? { 'Access-Control-Allow-Private-Network': 'true' }
          : {}),
      })
      res.end()
      return
    }

    const url = new URL(req.url || '/', getOrigin(req))

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/auth/login`) {
      await handleAuthLogin(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/auth/signup`) {
      await handleAuthSignup(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/auth/refresh`) {
      await handleAuthRefresh(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/auth/logout`) {
      await handleAuthLogout(req, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/me`) {
      handleMeRead(req, res)
      return
    }

    if (req.method === 'PATCH' && url.pathname === `${API_PREFIX}/me`) {
      await handleMePatch(req, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/me/bookmarks`) {
      handleBookmarksRead(req, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/genres`) {
      handleGenresRead(res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/clips`) {
      handleCatalogRead(url, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/feed/clips`) {
      handleFeedRead(url, res)
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/comments`) {
      handleCommentsRead(req, res)
      return
    }

    const clipCommentsMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/clips/([^/]+)/comments$`)
    )
    if (clipCommentsMatch) {
      const clipId = clipCommentsMatch[1]
      if (req.method === 'GET') {
        handleClipCommentsRead(req, clipId, res)
        return
      }

      if (req.method === 'POST') {
        await handleCommentCreate(req, res, clipId)
        return
      }
    }

    const commentLikeMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/comments/([^/]+)/like$`))
    if (commentLikeMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      handleCommentLikeToggle(req, res, commentLikeMatch[1])
      return
    }

    const likeMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/clips/([^/]+)/like$`))
    if (likeMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      handleLikeToggle(req, res, likeMatch[1])
      return
    }

    const bookmarkMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/clips/([^/]+)/bookmark$`))
    if (bookmarkMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      handleBookmarkToggle(req, res, bookmarkMatch[1])
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/moderation/comments`) {
      handleModerationRead(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/moderation/comments/block-user`) {
      await handleBlockUser(req, res)
      return
    }

    const moderationCommentMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/moderation/comments/([^/]+)$`)
    )
    if (moderationCommentMatch && req.method === 'DELETE') {
      handleDeleteComment(req, res, moderationCommentMatch[1])
      return
    }

    const moderationUserMatch = url.pathname.match(
      new RegExp(`^${API_PREFIX}/moderation/comments/by-user/([^/]+)$`)
    )
    if (moderationUserMatch && req.method === 'DELETE') {
      handleDeleteCommentsByUser(req, res, moderationUserMatch[1])
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/admin/clips/upload-url`) {
      await handleUploadUrlCreate(req, res)
      return
    }

    const uploadPutMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/uploads/([^/]+)$`))
    if (storageAdapter.supportsLocalUpload && uploadPutMatch && req.method === 'PUT') {
      await handleUploadPut(req, res, uploadPutMatch[1])
      return
    }

    const assetMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/assets/([^/]+)$`))
    if (storageAdapter.supportsAssetRead && assetMatch && req.method === 'GET') {
      await handleAssetRead(res, assetMatch[1])
      return
    }

    if (req.method === 'POST' && url.pathname === `${API_PREFIX}/admin/clips`) {
      await handleAdminClipCreate(req, res)
      return
    }

    const adminClipMatch = url.pathname.match(new RegExp(`^${API_PREFIX}/admin/clips/([^/]+)$`))
    if (adminClipMatch && req.method === 'PATCH') {
      await handleAdminClipUpdate(req, res, adminClipMatch[1])
      return
    }

    if (req.method === 'GET' && url.pathname === `${API_PREFIX}/admin/clips`) {
      handleAdminClipsRead(req, res)
      return
    }

    sendError(res, 404, 'Not found', 'NOT_FOUND')
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : 'Unknown error', 'INTERNAL_ERROR')
  }
})

server.listen(PORT, () => {
  console.info(
    `ClipFlow local API is listening on :${PORT} using ${storageAdapter.provider} storage`
  )
})
