import { toClipUiList } from './mappers/clip-mapper'
import {
  toCommentUiModel,
  toCommentsMapUiModel,
  toModerationCommentUiList,
} from './mappers/comment-mapper'
import { normalizeWritePayload } from './payload-normalizer'
import { authService } from './auth-service'

const DEFAULT_API_BASE_URL = '/api/v1'

function getApiBaseUrl() {
  const raw = import.meta.env?.VITE_API_BASE_URL

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return DEFAULT_API_BASE_URL
  }

  return raw.trim().replace(/\/$/, '')
}

function shouldSendLegacyCreateCommentAuthorFields() {
  const rawFlag = import.meta.env?.VITE_API_CREATE_COMMENT_LEGACY_AUTHOR_PAYLOAD

  if (typeof rawFlag !== 'string') {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(rawFlag.trim().toLowerCase())
}

function buildUrl(path, query = undefined) {
  const baseUrl = getApiBaseUrl()
  const url = new URL(`${baseUrl}${path}`, window.location.origin)

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          url.searchParams.append(key, String(item))
        })
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  return `${url.pathname}${url.search}`
}

async function parseJsonSafe(response) {
  const raw = await response.text()

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function resolveApiErrorMessage(payload) {
  const message = payload?.error?.message || payload?.message

  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }

  return 'API request failed'
}

async function requestJson(path, { method = 'GET', query, body } = {}) {
  const url = buildUrl(path, query)

  async function doFetch() {
    try {
      const accessToken = await authService.getValidAccessToken()

      return await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new Error(`Network request failed for ${method} ${path}`, { cause: error })
    }
  }

  let response = await doFetch()

  if (response.status === 401 && authService.isApiDataSource()) {
    await authService.restoreSession()
    response = await doFetch()
  }

  if (!response.ok) {
    const payload = await parseJsonSafe(response)
    throw new Error(`${resolveApiErrorMessage(payload)} (${response.status})`)
  }

  return parseJsonSafe(response)
}

function toggleBooleanMapEntry(map, key) {
  return {
    ...(map || {}),
    [key]: !map?.[key],
  }
}

function shouldCreateToggleEntity(currentValue) {
  return !currentValue
}

function toggleArrayEntry(list, value) {
  const safeList = Array.isArray(list) ? list : []

  return safeList.includes(value) ? safeList.filter((item) => item !== value) : [...safeList, value]
}

function groupCommentsByClip(comments = []) {
  return comments.reduce((acc, comment) => {
    const normalized = toCommentUiModel(comment, comment?.clipId)
    const clipId = normalized.clipId

    if (!Array.isArray(acc[clipId])) {
      acc[clipId] = []
    }

    acc[clipId].push(normalized)
    return acc
  }, {})
}

function toSafeProfileCount(value) {
  const normalized = Number(value)

  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0
  }

  return Math.trunc(normalized)
}

function resolveProfileCount(payload, keys = []) {
  for (const key of keys) {
    if (payload && Object.hasOwn(payload, key)) {
      return toSafeProfileCount(payload[key])
    }
  }

  return 0
}

/** @type {import('./feed-adapter').FeedAdapter} */
export const apiFeedAdapter = {
  async getFeed({ selectedGenres = [] } = {}) {
    const payload = await requestJson('/feed/clips', {
      query: selectedGenres.length > 0 ? { genre: selectedGenres } : undefined,
    })

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async toggleLike(params) {
    const payload = normalizeWritePayload('toggleLike', params)
    const method = shouldCreateToggleEntity(payload.likes[payload.clipId]) ? 'POST' : 'DELETE'

    const response = await requestJson(`/clips/${payload.clipId}/like`, {
      method,
    })

    if (response?.likes && typeof response.likes === 'object') {
      return response.likes
    }

    return toggleBooleanMapEntry(payload.likes, payload.clipId)
  },

  async toggleBookmark(params) {
    const payload = normalizeWritePayload('toggleBookmark', params)
    const method = shouldCreateToggleEntity(payload.bookmarks.includes(payload.clipId))
      ? 'POST'
      : 'DELETE'

    const response = await requestJson(`/clips/${payload.clipId}/bookmark`, {
      method,
    })

    if (Array.isArray(response?.bookmarks)) {
      return response.bookmarks
    }

    return toggleArrayEntry(payload.bookmarks, payload.clipId)
  },

  async persistLikeToggle(params) {
    const payload = normalizeWritePayload('persistLikeToggle', params)
    const method = payload.shouldLike === false ? 'DELETE' : 'POST'

    await requestJson(`/clips/${payload.clipId}/like`, {
      method,
    })
  },

  async persistBookmarkToggle(params) {
    const payload = normalizeWritePayload('persistBookmarkToggle', params)
    const method = payload.shouldBookmark === false ? 'DELETE' : 'POST'

    await requestJson(`/clips/${payload.clipId}/bookmark`, {
      method,
    })
  },

  async createComment(params) {
    const payload = normalizeWritePayload('createComment', params)

    const requestBody = {
      body: payload.text,
    }

    if (shouldSendLegacyCreateCommentAuthorFields()) {
      requestBody.userName = payload.userName
      requestBody.authorId = payload.authorId
    }

    const response = await requestJson(`/clips/${payload.clipId}/comments`, {
      method: 'POST',
      body: requestBody,
    })

    const commentData = response?.comment || response
    const normalizedComment = toCommentUiModel(commentData, payload.clipId)

    return {
      ...payload.comments,
      [payload.clipId]: [normalizedComment, ...(payload.comments[payload.clipId] || [])],
    }
  },

  async getAllCommentsForModeration({ clips = [], blockedUsers = {} } = {}) {
    const payload = await requestJson('/moderation/comments')
    const rows = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : []

    return toModerationCommentUiList(rows, { clips, blockedUsers })
  },

  async blockUserComments(params) {
    const payload = normalizeWritePayload('blockUserComments', params)

    await requestJson('/moderation/comments/block-user', {
      method: 'POST',
      body: { authorId: payload.authorId, isBlocked: true },
    })

    return {
      ...payload.blockedUsers,
      [payload.authorId]: true,
    }
  },

  async deleteComment(params) {
    const payload = normalizeWritePayload('deleteComment', params)

    await requestJson(`/moderation/comments/${payload.commentId}`, {
      method: 'DELETE',
    })

    return {
      ...payload.comments,
      [payload.clipId]: (payload.comments[payload.clipId] || [])
        .map((comment) => toCommentUiModel(comment, payload.clipId))
        .filter((comment) => comment.id !== payload.commentId),
    }
  },

  async deleteCommentsByUser(params) {
    const payload = normalizeWritePayload('deleteCommentsByUser', params)

    await requestJson(`/moderation/comments/by-user/${payload.authorId}`, {
      method: 'DELETE',
    })

    return Object.entries(payload.comments).reduce((acc, [clipId, clipComments]) => {
      const normalizedComments = Array.isArray(clipComments)
        ? clipComments.map((comment) => toCommentUiModel(comment, clipId))
        : []

      acc[clipId] = normalizedComments.filter((comment) => comment.authorId !== payload.authorId)
      return acc
    }, {})
  },

  async getCatalog() {
    const payload = await requestJson('/clips')

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async getBookmarks() {
    const payload = await requestJson('/me/bookmarks')

    if (Array.isArray(payload)) {
      return toClipUiList(payload)
    }

    return toClipUiList(Array.isArray(payload?.items) ? payload.items : [])
  },

  async getProfile({ user } = {}) {
    const payload = await requestJson('/me')

    const counts = payload?.counts && typeof payload.counts === 'object' ? payload.counts : {}
    const watched =
      payload?.activity && typeof payload.activity === 'object' ? payload.activity : {}

    return {
      name: payload?.displayName || payload?.name || user?.name || 'Movie Explorer',
      email: payload?.email || user?.email || 'hello@movieexplorer.app',
      avatar: payload?.avatarUrl || payload?.avatar || user?.avatar || '🎬',
      bookmarkCount:
        resolveProfileCount(payload, ['bookmarkCount', 'bookmarksCount']) ||
        resolveProfileCount(counts, ['bookmarks', 'bookmarkCount']),
      likeCount:
        resolveProfileCount(payload, ['likeCount', 'likesCount']) ||
        resolveProfileCount(counts, ['likes', 'likeCount']),
      watchedCount:
        resolveProfileCount(payload, ['watchedCount']) ||
        resolveProfileCount(counts, ['watched', 'watchedCount']) ||
        resolveProfileCount(watched, ['watched', 'clips']),
    }
  },

  async getInitialComments() {
    const payload = await requestJson('/comments')

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return toCommentsMapUiModel(payload)
    }

    const rows = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : []
    return toCommentsMapUiModel(groupCommentsByClip(rows))
  },
}
